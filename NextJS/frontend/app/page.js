'use client';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function Home() {
  const [url, setUrl] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [isWebsiteDown, setIsWebsiteDown] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('desktop');

  const deviceResolutions = {
    desktop: { width: 1920, height: 1080 },
    laptop: { width: 1366, height: 768 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 },
    'iphone-x': { width: 375, height: 812 },
    'ipad-pro': { width: 1024, height: 1366 },
    '4k': { width: 3840, height: 2160 }
  };

  useEffect(() => {
    const socketInstance = io(`http://${window.location.hostname}:3001`);
    setSocket(socketInstance);

    socketInstance.on('screenshot-completed', (data) => {
      if (data.down) {
        setIsWebsiteDown(true);
        setScreenshot(null);
      } else {
        setIsWebsiteDown(false);
        setScreenshot(data.screenshotURL);
      }
      setIsLoading(false);
    });

    return () => socketInstance.disconnect();
  }, []);

  const handleSubmit = async () => {
    if (!url) return;

    try {
      // Validate URL and add protocol if missing
      let validUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = 'https://' + url;
      }
      
      // Validate URL format
      try {
        new URL(validUrl);
      } catch (error) {
        throw new Error('Invalid URL format');
      }
      
      setIsLoading(true);
      setIsWebsiteDown(false);
      
      const response = await fetch(`http://${window.location.hostname}:3002/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Socket-ID': socket?.id,
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, X-Socket-ID'
        },
        body: JSON.stringify({ 
          url: validUrl,
          viewport: deviceResolutions[selectedDevice]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Screenshot request failed');
      }

    } catch (error) {
      console.error('Error:', error.message);
      setIsLoading(false);
      alert(error.message); // Show error to user
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-4 md:p-8 lg:p-20 gap-8 md:gap-16">
      <main className="w-full max-w-7xl flex flex-col gap-4 md:gap-8 row-start-2 items-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center md:text-left">Scalable Website ScreenShot Taker</h1>
        
        <input 
          type="url"
          required={true}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL" 
          className="w-full max-w-2xl p-2 md:p-3 rounded-md border border-gray-300 
            bg-opacity-20 backdrop-blur-sm bg-black
            transition-all duration-300 outline-none 
            placeholder-gray-500 text-sm md:text-base"
        />

        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full max-w-2xl p-2 md:p-3 rounded-md border border-gray-300 
            bg-opacity-20 backdrop-blur-sm bg-black
            transition-all duration-300 outline-none
            text-sm md:text-base"
          style={{ backgroundColor: 'black', color: 'white' }}
        >
          <option value="desktop" style={{ backgroundColor: 'black' }}>Desktop (1920x1080)</option>
          <option value="laptop" style={{ backgroundColor: 'black' }}>Laptop (1366x768)</option>
          <option value="tablet" style={{ backgroundColor: 'black' }}>Tablet (768x1024)</option>
          <option value="mobile" style={{ backgroundColor: 'black' }}>Mobile (375x667)</option>
          <option value="iphone-x" style={{ backgroundColor: 'black' }}>iPhone X (375x812)</option>
          <option value="ipad-pro" style={{ backgroundColor: 'black' }}>iPad Pro (1024x1366)</option>
          <option value="4k" style={{ backgroundColor: 'black' }}>4K Display (3840x2160)</option>
        </select>

        <div className="w-full max-w-2xl flex gap-4 items-center justify-center md:justify-start">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !socket}
            className="rounded-full border border-solid border-transparent 
              transition-colors flex items-center justify-center 
              bg-foreground text-background gap-2 
              hover:bg-[#383838] dark:hover:bg-[#ccc] 
              text-sm md:text-base 
              h-10 md:h-12 
              px-4 md:px-6
              w-full md:w-auto"
          >
            {isLoading ? 'Processing...' : 'Take Screenshot Now'}
          </button>
        </div>

        {isWebsiteDown && (
          <p className="text-red-500 font-semibold text-sm md:text-base">Website is down or unreachable</p>
        )}

        <div className="w-full max-w-6xl aspect-[16/9] min-h-[300px] md:min-h-[400px] relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/10">
              <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : screenshot ? (
            <img src={`http://${window.location.hostname}:3002/${screenshot}`} alt="Website Screenshot" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full max-w-[100%] max-h-[100%] bg-gray-100/10 flex items-center justify-center text-gray-400 text-sm md:text-base">
              No screenshot taken yet
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
