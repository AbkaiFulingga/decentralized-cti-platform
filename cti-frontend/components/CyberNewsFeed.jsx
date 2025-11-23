// components/CyberNewsFeed.jsx
'use client';

import { useState, useEffect } from 'react';

export default function CyberNewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCyberNews();
    const interval = setInterval(fetchCyberNews, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchCyberNews = async () => {
    try {
      const response = await fetch('/api/cyber-news', {
        cache: 'no-store' // Prevent caching for fresh data
      });
      const data = await response.json();
      
      if (data.success) {
        setNews(data.articles);
        setError('');
      } else {
        setError('Failed to load threat intelligence feed');
      }
      setLoading(false);
    } catch (error) {
      console.error('News fetch error:', error);
      setError('Failed to connect to threat intelligence API');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-12">
      <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🎯</span> Live Threat Intelligence Feed
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            AlienVault OTX + RSS
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Loading latest threats...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">⚠️ {error}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((article, index) => (
              <a
                key={index}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-purple-950/50 hover:bg-purple-950/70 rounded-lg p-4 border border-purple-700/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl group-hover:scale-110 transition-transform">
                    {article.emoji}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-purple-300 transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`px-2 py-0.5 rounded ${
                        article.source === 'AlienVault OTX' 
                          ? 'bg-red-500/20 text-red-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {article.source}
                      </span>
                      <span>•</span>
                      <span>{new Date(article.pubDate).toLocaleDateString()}</span>
                      {article.tags && (
                        <>
                          <span>•</span>
                          <span className="text-purple-400">{article.tags.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
              </a>
            ))}
          </div>
        )}
        
        <div className="mt-6 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <p className="text-purple-200 text-xs text-center">
            💡 Real-time APT tracking and threat intelligence from AlienVault OTX and security news sources
          </p>
        </div>
      </div>
    </div>
  );
}
