const fs = require('fs');
let key = '';
try {
  const env = fs.readFileSync('.env.local', 'utf8');
  key = env.split('GEMINI_API_KEY=')[1].split('\n')[0].trim();
} catch(e) {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    key = env.split('GEMINI_API_KEY=')[1].split('\n')[0].trim();
  } catch(e2) {}
}

if(key) {
  fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    .then(res => res.json())
    .then(data => {
      if (data.models) {
          console.log("Available models:");
          data.models.forEach(m => {
              if (m.name.includes("gemini")) console.log(m.name, m.supportedGenerationMethods);
          });
      } else {
          console.log(data);
      }
    }).catch(console.error);
} else {
  console.log("No key found");
}
