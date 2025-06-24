import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const carMappings = {
	"audi r8 lms gt3 evo ii": 31, "amr v8 vantage": 20, "bmw m4 gt3": 30,
	"ferrari 296 gt3": 32, "honda nsx gt3 evo": 21, "lamborghini huracan gt3 evo 2": 33,
	"mclaren 720s gt3 evo": 35, "mercedes amg gt3": 25, "porsche 992 gt3 r": 34,
	"ford mustang gt3": 36, "bentley continental": 8, "nissan gtr nismo gt3": 6,
	"alpine a110 gt4": 50, "aston martin vantage gt4": 51, "audi r8 lms gt4": 52,
	"bmw m4 gt4": 53, "chevrolet camaro gt4": 55, "ginetta g55 gt4": 56,
	"ktm x bow gt4": 57, "maserati mc gt4": 58, "mclaren 570s gt4": 59,
	"mercedes amg gt4": 60, "porsche 718 cayman gt4 clubsport": 61,
};

const trackMap = {
	"Autodromo Enzo e Dino Ferrari": "imola", "Autodromo Nazionale di Monza": "monza",
	"Brands Hatch Circuit": "brands_hatch", "Circuit de Catalunya": "barcelona",
	"Circuit de Paul Ricard": "paul_ricard", "Circuit de Spa Francorchamps": "spa",
	"Circuit Of The Americas": "cota", "Circuit Ricardo Tormo": "valencia",
	"Donington Park": "donington", "Hungaroring": "hungaroring",
	"Indianapolis": "indianapolis", "Kyalami": "kyalami", "Laguna Seca": "laguna_seca",
	"Misano": "misano", "Mount Panorama Circuit": "mount_panorama",
	"Nürburgring": "nurburgring", "Nürburgring Nordschleife 24h": "nurburgring_24h",
	"Oulton Park": "oulton_park", "Silverstone": "silverstone", "Snetterton": "snetterton",
	"Spielberg - Red Bull Ring": "red_bull_ring", "Suzuka Circuit": "suzuka",
	"Watkins Glen": "watkins_glen", "Zandvoort": "zandvoort", "Zolder": "zolder",
};

function findCarId(name) {
	const n = name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
	if (carMappings[n]) return carMappings[n];

	for (const [k, v] of Object.entries(carMappings)) {
		const kWords = k.split(" "), nWords = n.split(" ");
		const matches = kWords.filter(kw => nWords.some(nw => nw.includes(kw) || kw.includes(nw))).length;
		if (matches >= Math.min(3, kWords.length - 1)) return v;
	}
	console.log(`Car not found: "${name}"`);
	return -1;
}

function parseHTML(html, filter = null) {
	const entries = [], sections = html.split(/<h3[^>]*>/i);

	for (let i = 1; i < sections.length; i++) {
		const s = sections[i], trackMatch = s.match(/^([^<]+)/);
		if (!trackMatch) continue;

		const trackId = trackMap[trackMatch[1].trim()];
		if (!trackId) continue;

		const tableMatch = s.match(/<table[^>]*>.*?<\/table>/is);
		if (!tableMatch) continue;

		const rows = tableMatch[0].match(/<tr[^>]*>.*?<\/tr>/gis);
		if (!rows) continue;

		for (const row of rows) {
			if (row.includes("<th")) continue;
			const cells = row.match(/<td[^>]*>(.*?)<\/td>/gis);
			if (!cells || cells.length < 4) continue;

			const [cls, car, , ballast] = cells.map(c => c.replace(/<[^>]*>/g, "").trim());
			if (filter && !cls.toLowerCase().includes(filter.toLowerCase())) continue;

			const carId = findCarId(car), ballastMatch = ballast.match(/([-+]?\d+)\s*kg/i);
			if (carId !== -1 && ballastMatch) {
				const b = parseInt(ballastMatch[1]);
				if (!isNaN(b) && b >= -50 && b <= 50) {
					entries.push({ track: trackId, carModel: carId, ballastKg: b });
				}
			}
		}
	}
	return entries;
}

async function scrapeTab(page, tab = null) {
	if (tab) {
		await page.evaluate(t => {
			const tabs = document.querySelectorAll('[role="tab"]');
			for (const tab of tabs) {
				if (tab.textContent?.toLowerCase().includes(t.toLowerCase())) {
					tab.click();
					return;
				}
			}
		}, tab);
		await new Promise(r => setTimeout(r, 5000));
	}
	return await page.evaluate(() => document.body.innerHTML);
}

async function scrapeBoPData() {
	let browser;
	try {
		console.log("🚀 Starting scraper...");
		browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
				   "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote", "--disable-gpu"],
		});

		const page = await browser.newPage();
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
		await page.setViewport({ width: 1280, height: 720 });

		console.log("📡 Loading page...");
		await page.goto("https://lowfuelmotorsport.com/seasonsv2/bop", {
			waitUntil: "networkidle0", timeout: 30000,
		});

		await new Promise(r => setTimeout(r, 10000));

		const gt3Html = await scrapeTab(page), gt4Html = await scrapeTab(page, "GT4");
		const gt3 = parseHTML(gt3Html), gt4 = parseHTML(gt4Html, "gt4");
		const all = [...gt3, ...gt4];

		console.log(`📊 Found ${gt3.length} GT3, ${gt4.length} GT4 = ${all.length} total`);

		const distDir = path.resolve("dist");
		!fs.existsSync(distDir) && fs.mkdirSync(distDir, { recursive: true });

		fs.writeFileSync(path.resolve("dist", "bop.json"), JSON.stringify({ entries: all }, null, 2));
		console.log("✅ Generated dist/bop.json");
		return { entries: all };
	} catch (error) {
		console.error("❌ Error:", error);
		throw error;
	} finally {
		browser && await browser.close();
	}
}

scrapeBoPData()
	.then(() => { console.log("🎉 Complete!"); process.exit(0); })
	.catch(e => { console.error("💥 Failed:", e); process.exit(1); });