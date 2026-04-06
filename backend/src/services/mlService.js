const axios = require('axios');
const FormData = require('form-data');

const client = axios.create({
  baseURL: process.env.ML_SERVICE_URL || 'http://ml-service:8000',
  timeout: 10000,
});

async function analyzeImage(imageBuffer, filename, pose) {
  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: filename || 'frame.jpg',
    contentType: filename && filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
  });
  formData.append('pose', pose);

  const response = await client.post('/analyze', formData, {
    headers: formData.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return response.data;
}

module.exports = { analyzeImage };
