const readlineSync = require("readline-sync");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: "AIzaSyD5uC7FQvahJywDQ54jfXi2Gdk89NGn2aA" });

async function main(msg) {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ role: "user", parts: [{ text: msg }] }],
    generationConfig: {
      maxOutputTokens: 300
    }
  });
  return response.candidates[0].content.parts[0].text;
}

async function chating() {
  const question = readlineSync.question("How can I help you--> ");

  const prompt = `You are an AI agent who responds ONLY in JSON format.
Rules:
- No markdown, no code blocks. Output plain JSON only.
- Analyze user input, extract city and date.
- Date format: (yyyy-mm-dd) if future weather. If today's weather, use "today".
Example:
{
  "weather_details_needed": true,
  "location": [
    {"city": "mumbai", "date": "today"},
    {"city": "delhi", "date": "2025-10-12"}
  ]
}

User input: ${question}`;

  const res = await main(prompt);
  console.log("AI Response:", res);

  try {
    let cleaned = res.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log("Parsed successfully:", parsed);

    if (parsed.weather_details_needed) {
      const report = await getWeather(parsed.location);
      
      // Generate natural text response using LLM
      console.log("\nGenerating weather report...");
      const textReport = await generateTextReport(report, question);
      console.log("\n🌤️ Weather Report:");
      console.log(textReport);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function getWeather(locations) {
  const weatherInfo = [];
  
  for (const { city, date } of locations) {
    try {
      let searchCity = city;
      if (city.toLowerCase() === 'delhi') {
        searchCity = 'Delhi,India';
      } else if (city.toLowerCase() === 'mumbai') {
        searchCity = 'Mumbai,India';
      }
      
      let url;
      if (date.toLowerCase() === "today") {
        url = `https://api.weatherapi.com/v1/current.json?key=25bc9b43dda940a4a2965445250509&q=${searchCity}`;
      } else {
        url = `https://api.weatherapi.com/v1/forecast.json?key=25bc9b43dda940a4a2965445250509&q=${searchCity}&dt=${date}`;
      }

      console.log(`Fetching weather for ${searchCity}...`);
      const response = await axios.get(url);
      weatherInfo.push({ city, date, data: response.data });
    } catch (error) {
      weatherInfo.push({ city, date, error: error.message });
    }
  }
  return weatherInfo;
}

async function generateTextReport(weatherData, originalQuestion) {
  try {
    // Create weather summary for LLM
    let weatherSummary = "";
    
    for (const item of weatherData) {
      if (item.error) {
        weatherSummary += `Error for ${item.city}: ${item.error}\n`;
      } else if (item.data.current) {
        // Current weather
        const current = item.data.current;
        const location = item.data.location;
        weatherSummary += `Current weather in ${location.name}, ${location.region}, ${location.country}:
Temperature: ${current.temp_c}°C (feels like ${current.feelslike_c}°C)
Condition: ${current.condition.text}
Humidity: ${current.humidity}%
Wind: ${current.wind_kph} km/h from ${current.wind_dir}
Visibility: ${current.vis_km} km
`;
      } else if (item.data.forecast) {
        // Forecast weather
        const forecast = item.data.forecast.forecastday[0];
        weatherSummary += `Forecast for ${item.city} on ${item.date}:
High: ${forecast.day.maxtemp_c}°C, Low: ${forecast.day.mintemp_c}°C
Condition: ${forecast.day.condition.text}
Chance of rain: ${forecast.day.daily_chance_of_rain}%
`;
      }
    }

    // Ask LLM to generate natural response
    const textPrompt = `Based on the weather information below, write a natural, friendly, and helpful response to the user's question: "${originalQuestion}"

Weather Information:
${weatherSummary}

Instructions:
- Write in a conversational, friendly tone
- Include practical advice if relevant (what to wear, activities, etc.)
- Keep it informative but easy to read
- Don't use any JSON formatting, just plain text
- Make it sound natural like a weather reporter would say`;

    const textResponse = await main(textPrompt);
    return textResponse;
    
  } catch (error) {
    return `Sorry, I couldn't generate the weather report. Error: ${error.message}`;
  }
}

// Run
chating();