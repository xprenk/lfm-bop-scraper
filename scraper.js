import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const carNameMappings = {
	"audi r8 lms gt3 evo ii": 31,
	"amr v8 vantage": 20,
	"bmw m4 gt3": 30,
	"ferrari 296 gt3": 32,
	"honda nsx gt3 evo": 21,
	"lamborghini huracan gt3 evo 2": 33,
	"mclaren 720s gt3 evo": 35,
	"mercedes amg gt3": 25,
	"porsche 992 gt3 r": 34,
	"ford mustang gt3": 36,
	"bentley continental": 8,
	"nissan gtr nismo gt3": 6,

	"alpine a110 gt4": 50,
	"aston martin vantage gt4": 51,
	"audi r8 lms gt4": 52,
	"bmw m4 gt4": 53,
	"chevrolet camaro gt4": 55,
	"ginetta g55 gt4": 56,
	"ktm x bow gt4": 57,
	"maserati mc gt4": 58,
	"mclaren 570s gt4": 59,
	"mercedes amg gt4": 60,
	"porsche 718 cayman gt4 clubsport": 61,
};

const trackNameMap = {
	"Autodromo Enzo e Dino Ferrari": "imola",
	"Autodromo Nazionale di Monza": "monza",
	"Brands Hatch Circuit": "brands_hatch",
	"Circuit de Catalunya": "barcelona",
	"Circuit de Paul Ricard": "paul_ricard",
	"Circuit de Spa Francorchamps": "spa",
	"Circuit Of The Americas": "cota",
	"Circuit Ricardo Tormo": "valencia",
	"Donington Park": "donington",
	"Hungaroring": "hungaroring",
	"Indianapolis": "indianapolis",
	"Kyalami": "kyalami",
	"Laguna Seca": "laguna_seca",
	"Misano": "misano",
	"Mount Panorama Circuit": "mount_panorama",
	"Nürburgring": "nurburgring",
	"Nürburgring Nordschleife 24h": "nurburgring_24h",
	"Oulton Park": "oulton_park",
	"Silverstone": "silverstone",
	"Snetterton": "snetterton",
	"Spielberg - Red Bull Ring": "red_bull_ring",
	"Suzuka Circuit": "suzuka",
	"Watkins Glen": "watkins_glen",
	"Zandvoort": "zandvoort",
	"Zolder": "zolder",
};

function findCarModelId(carName) {
	const normalizedName = carName
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (carNameMappings[normalizedName]) {
		return carNameMappings[normalizedName];
	}

	for (const [key, value] of Object.entries(carNameMappings)) {
		const keyWords = key.split(" ");
		const nameWords = normalizedName.split(" ");

		const matchCount = keyWords.filter((keyWord) =>
			nameWords.some((nameWord) => nameWord.includes(keyWord) || keyWord.includes(nameWord))
		).length;

		if (matchCount >= Math.min(3, keyWords.length - 1)) {
			return value;
		}
	}

	console.log(`Car not found: "${carName}" (normalized: "${normalizedName}")`);
	return -1;
}

function parseHTMLStructure(html, classFilter = null) {
	const entries = [];
	const sections = html.split(/<h3[^>]*>/i);

	for (let i = 1; i < sections.length; i++) {
		const section = sections[i];

		const trackNameMatch = section.match(/^([^<]+)/);
		if (!trackNameMatch) continue;

		const fullTrackName = trackNameMatch[1].trim();
		const trackId = trackNameMap[fullTrackName];

		if (!trackId) {
			console.log(`Unknown track: "${fullTrackName}"`);
			continue;
		}

		const tableMatch = section.match(/<table[^>]*>.*?<\/table>/is);
		if (!tableMatch) continue;

		const tableHTML = tableMatch[0];
		const rowMatches = tableHTML.match(/<tr[^>]*>.*?<\/tr>/gis);
		if (!rowMatches) continue;

		for (const rowHTML of rowMatches) {
			if (rowHTML.includes("<th")) continue;

			const cellMatches = rowHTML.match(/<td[^>]*>(.*?)<\/td>/gis);
			if (!cellMatches || cellMatches.length < 4) continue;

			const cellTexts = cellMatches.map((cell) => cell.replace(/<[^>]*>/g, "").trim());

			if (cellTexts.length >= 4) {
				const carClass = cellTexts[0];
				const carName = cellTexts[1];
				const ballastText = cellTexts[3];

				if (classFilter && !carClass.toLowerCase().includes(classFilter.toLowerCase())) {
					continue;
				}

				const carModelId = findCarModelId(carName);
				const ballastMatch = ballastText.match(/([-+]?\d+)\s*kg/i);

				if (carModelId !== -1 && ballastMatch) {
					const ballast = parseInt(ballastMatch[1]);
					if (!isNaN(ballast) && ballast >= -50 && ballast <= 50) {
						entries.push({
							track: trackId,
							carModel: carModelId,
							ballastKg: ballast,
						});
					}
				}
			}
		}
	}

	return entries;
}

async function scrapeBoPData() {
	let browser;

	try {
		console.log("🚀 Starting LFM BoP data scraping...");

		browser = await puppeteer.launch({
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-accelerated-2d-canvas",
				"--no-first-run",
				"--no-zygote",
				"--disable-gpu",
			],
		});

		const page = await browser.newPage();
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
		await page.setViewport({ width: 1280, height: 720 });

		console.log("📡 Navigating to LFM BoP page...");
		await page.goto("https://lowfuelmotorsport.com/seasonsv2/bop", {
			waitUntil: "networkidle0",
			timeout: 30000,
		});

		console.log("⏳ Waiting for Angular to load...");
		await new Promise((resolve) => setTimeout(resolve, 10000));

		console.log("🏎️ Scraping GT3 data...");
		const gt3Data = await page.evaluate(() => {
			return {
				htmlContent: document.body.innerHTML,
				activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() || "unknown",
			};
		});

		console.log("🔄 Switching to GT4 tab...");
		const gt4TabClicked = await page.evaluate(() => {
			const tabs = document.querySelectorAll('[role="tab"]');

			for (let i = 0; i < tabs.length; i++) {
				const tab = tabs[i];
				const tabContent = tab.textContent?.trim();

				if (tabContent && tabContent.toLowerCase().includes("gt4")) {
					tab.click();
					return true;
				}
			}

			if (tabs.length >= 2) {
				tabs[1].click();
				return true;
			}

			return false;
		});

		if (gt4TabClicked) {
			console.log("✅ GT4 tab clicked, waiting for content...");
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}

		console.log("🏁 Scraping GT4 data...");
		const gt4Data = await page.evaluate(() => {
			return {
				htmlContent: document.body.innerHTML,
				activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() || "unknown",
			};
		});

		console.log("🔍 Parsing scraped data...");
		const gt3Entries = parseHTMLStructure(gt3Data.htmlContent);
		const gt4Entries = parseHTMLStructure(gt4Data.htmlContent, "gt4");

		const allEntries = [...gt3Entries, ...gt4Entries];

		console.log(`📊 Found ${gt3Entries.length} GT3 entries and ${gt4Entries.length} GT4 entries`);
		console.log(`📈 Total entries: ${allEntries.length}`);

		const bopData = {
			entries: allEntries
		};

		const distDir = path.resolve("dist");
		if (!fs.existsSync(distDir)) {
			fs.mkdirSync(distDir, { recursive: true });
		}

		const outputPath = path.resolve("dist", "bop.json");
		fs.writeFileSync(outputPath, JSON.stringify(bopData, null, 2));

		console.log(`✅ Successfully generated ${outputPath}`);
		console.log(`📋 Summary: ${gt3Entries.length} GT3 + ${gt4Entries.length} GT4 = ${allEntries.length} total entries`);

		return bopData;
	} catch (error) {
		console.error("❌ Error scraping BoP data:", error);
		throw error;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

scrapeBoPData()
	.then(() => {
		console.log("🎉 BoP data generation complete!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Failed to generate BoP data:", error);
		process.exit(1);
	});
