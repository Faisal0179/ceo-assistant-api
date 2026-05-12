const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");


const app = express();
app.use(cors());
app.use(express.json());
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://ceo-assistant-api.onrender.com/oauth2callback"
);

let gmailTokens = null;

let tasks = [
  { title: "Project", status: "pending" },
  { title: "Power BI", status: "pending" }
];
let emailDrafts = [];

app.get("/", (req, res) => {
  res.send("CEO Assistant API is running");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const task = {
    title: req.body.title,
    status: req.body.status || "pending",
    priority: req.body.priority || "medium"
  };

  tasks.push(task);
  res.json(task);
});
app.put("/api/tasks/:title", (req, res) => {
  const title = req.params.title;

const decodedTitle = decodeURIComponent(title);

const task = tasks.find(
  t => t.title.toLowerCase().includes(decodedTitle.toLowerCase())
);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  task.status = req.body.status || "completed";

  res.json(task);
});
app.delete("/api/tasks/:title", (req, res) => {
  const title = req.params.title;

const decodedTitle = decodeURIComponent(title);

const taskIndex = tasks.findIndex(
  t => t.title.toLowerCase().includes(decodedTitle.toLowerCase())
);
  if (index === -1) {
    return res.status(404).json({ message: "Task not found" });
  }

  const deleted = tasks.splice(index, 1);

  res.json({ message: "Task deleted", deleted });
});
app.get("/api/email-drafts", (req, res) => {
  res.json(emailDrafts);
});

app.post("/api/email-drafts", (req, res) => {
  const draft = {
    id: emailDrafts.length + 1,
    to: req.body.to || "",
    subject: req.body.subject || "No subject",
    body: req.body.body || "",
    status: "draft"
  };

  emailDrafts.push(draft);
  res.json(draft);
});

app.delete("/api/email-drafts/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = emailDrafts.findIndex(d => d.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Draft not found" });
  }

  const deleted = emailDrafts.splice(index, 1);
  res.json({ message: "Draft deleted", deleted });
});

const PORT = process.env.PORT || 3000;
app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.compose"]
  });

  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    gmailTokens = tokens;

    res.send("Gmail connected successfully.");
  } catch (error) {
    console.error(error);
    res.status(500).send("OAuth failed.");
  }
});

app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.compose"]
  });

  res.redirect(authUrl);
});

app.get("/debug-google", (req, res) => {
  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    clientIdEndsWith: process.env.GOOGLE_CLIENT_ID
      ? process.env.GOOGLE_CLIENT_ID.slice(-30)
      : null
  });
});

app.post("/api/gmail-drafts", async (req, res) => {
  if (!gmailTokens) {
    return res.status(401).json({ message: "Gmail is not connected. Visit /auth/google first." });
  }

  try {
    oauth2Client.setCredentials(gmailTokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const { to, subject, body } = req.body;

  const email = `To: ${to}
Subject: ${subject || "No subject"}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

${body || ""}`;

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedEmail
        }
      }
    });

    res.json({
      message: "Gmail draft created successfully",
      draftId: draft.data.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create Gmail draft",
      error: error.message
    });
  }
});


app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
