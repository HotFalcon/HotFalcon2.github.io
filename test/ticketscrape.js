// ==UserScript==
// @name         Ticket Price Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrolls ticket page, extracts prices from specific stadium sections, logs them, waits 5s, and refreshes.
// @author       Grok
// @match        https://seatgeek.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function scrollAndExtract() {
        // Scroll upward slightly
        window.scrollBy(0, -100);

        // Placeholder selectors for ticket price sections (update with specific sections)
        const selectors = [
            '.ticket-listing .section-name', // Example: ticket listings with section names
            '.price-display .amount'         // Example: price elements
        ];

        // Define target stadium sections (update with your semicircle sections)
        const targetSections = [
            'Section 111', 'Section 112', 'Section 113' // Example sections
        ];

        let prices = [];

        // Extract prices from specified elements
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.innerText.toLowerCase();
                // Check if element relates to target sections
                if (targetSections.some(section => text.includes(section.toLowerCase()))) {
                    // Extract price (e.g., $25, $25.00, or 25)
                    const priceMatch = el.innerText.match(/\$?\d+(\.\d{2})?/);
                    if (priceMatch) {
                        prices.push(priceMatch[0]);
                    }
                }
            });
        });

        // Log unique prices
        if (prices.length > 0) {
            console.log('Ticket prices for specified sections:', [...new Set(prices)]);
        } else {
            console.log('No prices found in specified sections.');
        }

        // Wait 5 seconds, then refresh
        setTimeout(() => {
            location.reload();
        }, 5000);
    }

    // Run after page load
    window.addEventListener('load', () => {
        setTimeout(scrollAndExtract, 1000); // Delay to ensure page is ready
    });
})();