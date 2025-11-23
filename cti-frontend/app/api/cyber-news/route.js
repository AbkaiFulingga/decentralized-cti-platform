// app/api/cyber-news/route.js
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export async function GET() {
  try {
    const parser = new Parser({
      timeout: 10000,
      customFields: {
        item: ['description', 'content:encoded']
      }
    });
    
    const allItems = [];

    // AlienVault OTX - APT and Threat Intelligence Pulses
    try {
      console.log('Fetching AlienVault OTX...');
      const otxResponse = await fetch(
        'https://otx.alienvault.com/api/v1/pulses/subscribed?page=1&limit=5',
        {
          headers: {
             'X-OTX-API-KEY': process.env.ALIENVAULT_API_KEY // Use env variable
          }
        }
      );
      
      if (otxResponse.ok) {
        const otxData = await otxResponse.json();
        
        if (otxData.results) {
          const aptPulses = otxData.results.slice(0, 3).map(pulse => ({
            title: pulse.name || 'Unnamed Threat Pulse',
            link: `https://otx.alienvault.com/pulse/${pulse.id}`,
            pubDate: pulse.created || new Date().toISOString(),
            source: 'AlienVault OTX',
            type: 'APT Intelligence',
            emoji: '🎯',
            tags: pulse.tags ? pulse.tags.slice(0, 3) : []
          }));
          allItems.push(...aptPulses);
          console.log(`✅ AlienVault OTX: ${aptPulses.length} pulses fetched`);
        }
      } else {
        console.error(`❌ AlienVault OTX API error: ${otxResponse.status}`);
      }
    } catch (error) {
      console.error('❌ Error fetching AlienVault OTX:', error.message);
    }

    // Bleeping Computer - Security News
    try {
      console.log('Fetching Bleeping Computer...');
      const feed = await parser.parseURL('https://www.bleepingcomputer.com/feed/');
      const items = feed.items.slice(0, 3).map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        source: 'Bleeping Computer',
        type: 'Security News',
        emoji: '💻',
        tags: []
      }));
      allItems.push(...items);
      console.log(`✅ Bleeping Computer: ${items.length} articles fetched`);
    } catch (error) {
      console.error('❌ Error fetching Bleeping Computer:', error.message);
    }

    // Krebs on Security - Investigations
    try {
      console.log('Fetching Krebs on Security...');
      const feed = await parser.parseURL('https://krebsonsecurity.com/feed/');
      const items = feed.items.slice(0, 2).map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '#',
        pubDate: item.pubDate || new Date().toISOString(),
        source: 'Krebs on Security',
        type: 'Investigation',
        emoji: '🔍',
        tags: []
      }));
      allItems.push(...items);
      console.log(`✅ Krebs on Security: ${items.length} articles fetched`);
    } catch (error) {
      console.error('❌ Error fetching Krebs:', error.message);
    }

    // Sort by date (newest first)
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    return NextResponse.json({
      success: true,
      articles: allItems.slice(0, 8), // Return 8 latest items
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feed aggregation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
