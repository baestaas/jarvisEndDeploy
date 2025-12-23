import express from "express";
import cors from "cors";
import routes from "./routes-fixed.js";

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", routes);

// Health check (Render требует живой порт)
app.get("/", (_req, res) => {
  res.send("OK");
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
