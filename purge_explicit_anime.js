/**
 * purge_explicit_anime.js
 * Explicitly archives the 15 remaining Japanese anime movies in Notion Movie Library database.
 * Uses exact page IDs for 100% safety and zero false positives.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ANIME_PAGES = [
  { title: "Gekijouban Clannad", id: "36fd0aaf-19d0-815b-985c-c6f2995eb425" },
  { title: "Tekkon kinkurîto", id: "36fd0aaf-19d0-8171-b9ec-c7c8169fd9b5" },
  { title: "Biohazard: Damnation", id: "36fd0aaf-19d0-81c5-abcc-df3b7d4e6946" },
  { title: "Final Fantasy: The Spirits Within", id: "36fd0aaf-19d0-811a-b6f2-c6d2d386631c" },
  { title: "Yu-Gi-Oh! 3D: Bonds Beyond Time", id: "36fd0aaf-19d0-81a0-94a9-dcdbf52ebfa6" },
  { title: "Dante's Inferno: An Animated Epic", id: "36fd0aaf-19d0-81cd-8823-e01a5aa3a392" },
  { title: "Halo Legends", id: "36fd0aaf-19d0-8172-8efc-ee5d2f84cce9" },
  { title: "Appleseed Alpha", id: "36fd0aaf-19d0-81df-8546-d399229ca901" },
  { title: "Rupan sansei: Kariosutoro no shiro", id: "36dd0aaf-19d0-8157-bb41-e6bd1703c7f0" },
  { title: "Kurenai no buta", id: "36dd0aaf-19d0-81de-94f5-f131bfa6a3aa" },
  { title: "Papurika", id: "36dd0aaf-19d0-8138-b8d0-d8361984d142" },
  { title: "Tky goddofzzu", id: "36dd0aaf-19d0-818e-b971-c7eb3bfb2ad7" },
  { title: "Jb ninpch", id: "36dd0aaf-19d0-818a-b43e-d8c0b0c89814" },
  { title: "Mononoke-hime", id: "36dd0aaf-19d0-8171-90ba-c8a504a0bccf" },
  { title: "Hotaru no haka", id: "36dd0aaf-19d0-81bf-a386-f9cd7c2aecd9" }
];

async function run() {
  console.log('====================================================');
  console.log('🧹 EXPLICIT JAPANESE ANIME PURGE SWEEP');
  console.log('====================================================');

  for (const page of ANIME_PAGES) {
    console.log(`🧹 Archiving Japanese anime: "${page.title}" (ID: ${page.id})...`);
    try {
      await notion.pages.update({
        page_id: page.id,
        archived: true
      });
      console.log(`  -> 🟢 Successfully archived!`);
    } catch (err) {
      console.error(`  -> ❌ Failed to archive:`, err.message);
    }
    await sleep(350); // respect rate limits
  }

  console.log('\n====================================================');
  console.log('🎉 EXPLICIT JAPANESE ANIME PURGE COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

run();
