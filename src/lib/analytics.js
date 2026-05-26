import ReactGA from "react-ga4";

/**
 * Initialize GA4 with the measurement ID
 * @param {string} measurementId - The G-XXXXXXXXXX ID from Google Analytics
 */
export const initGA = (measurementId) => {
  if (measurementId) {
    ReactGA.initialize(measurementId);
    console.log("GA4 Initialized with ID:", measurementId);
  }
};

/**
 * Track a page view
 * @param {string} path - The current path/tab
 */
export const trackPageView = (path) => {
  ReactGA.send({ hitType: "pageview", page: path });
};

/**
 * Track a custom event
 * @param {string} category - Event category
 * @param {string} action - Event action
 * @param {string} label - Event label (optional)
 */
export const trackEvent = (category, action, label) => {
  ReactGA.event({
    category: category,
    action: action,
    label: label,
  });
};
