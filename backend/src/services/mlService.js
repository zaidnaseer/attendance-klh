const axios = require('axios');
const FormData = require('form-data');

const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 30000);
const ML_RETRY_COUNT = Number(process.env.ML_RETRY_COUNT || 1);
const ML_RETRY_DELAY_MS = Number(process.env.ML_RETRY_DELAY_MS || 300);

const client = axios.create({
  baseURL: process.env.ML_SERVICE_URL || 'http://ml-service:8000',
  timeout: Number.isFinite(ML_TIMEOUT_MS) && ML_TIMEOUT_MS > 0 ? ML_TIMEOUT_MS : 30000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientMlError(error) {
  if (!error) {
    return false;
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  if (error.response && error.response.status >= 500) {
    return true;
  }
  return false;
}

async function postToMlWithRetry(path, formData) {
  let attempt = 0;
  while (true) {
    try {
      const response = await client.post(path, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return response.data;
    } catch (error) {
      if (attempt >= ML_RETRY_COUNT || !isTransientMlError(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(Math.max(0, ML_RETRY_DELAY_MS));
    }
  }
}

async function analyzeImage(imageBuffer, filename, pose) {
  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: filename || 'frame.jpg',
    contentType: filename && filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
  });
  formData.append('pose', pose);

  return postToMlWithRetry('/analyze', formData);
}

async function verifyImage(imageBuffer, filename) {
  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: filename || 'frame.jpg',
    contentType: filename && filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
  });

  return postToMlWithRetry('/verify', formData);
}

module.exports = { analyzeImage, verifyImage };
