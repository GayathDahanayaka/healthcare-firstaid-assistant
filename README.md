# Smart First-Aid Assistant

An AI-powered virtual assistant that gives first-aid guidance grounded in
IFRC guidelines, with a customizable 3D avatar and support for English,
Sinhala, and Singlish.

## Dependencies

- Node.js v18+ and npm
- A free Gemini API key (get one at https://aistudio.google.com/app/apikey)
- The IFRC first-aid guideline PDF, placed in `server/knowledge/documents/`

## Setup Steps

**Backend:**
```bash
cd server
npm install
```
Copy `.env.example` to `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_key_here
PORT=5000
```

**Frontend:**
```bash
cd client
npm install
```

## How to Run

**1. Start the backend:**
```bash
cd server
npm run dev
```
The first run embeds the knowledge base and caches it to disk (takes under
a minute). Every run after that loads instantly from the cache.

**2. Start the frontend (in a separate terminal):**
```bash
cd client
npm run dev
```
Open the local URL shown in the terminal.

**3. First-time use:**
The first screen is the avatar creator (Avaturn), not the chat — this is
expected. Design your avatar and click "Next"/"Done" to export it; the app
then switches to the chat screen automatically. Your avatar is saved in the
browser, so future visits skip straight to chat. Use "Change Avatar" in the
sidebar to redesign it anytime.

## Assumptions

- The IFRC first-aid guideline PDF is present in `server/knowledge/documents/`
  before the first run.
- A valid, non-rate-limited Gemini API key is available for the first
  (embedding) run. Later runs work without hitting the embedding API again,
  since results are cached to disk.
- Ports 5000 (backend) and the frontend's default Vite port are free on
  your machine. Change `PORT` in `.env` if 5000 is already in use.

## Disclaimer

This assistant provides general first-aid guidance only and does not
replace professional medical care. In a real emergency, contact emergency
services immediately (1990 in Sri Lanka).