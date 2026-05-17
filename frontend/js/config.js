// config.js - API configuration
// Automatically detect environment based on hostname
const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000/api'
    : 'https://datamatch-x-production.up.railway.app/api'
};
