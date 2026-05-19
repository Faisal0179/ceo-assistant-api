const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const axios = require("axios");


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public", { index: false }));
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
let latestAnalysis = null;
let latestMakeResult = null;
const MAKE_WEBHOOK = "https://hook.eu1.make.com/febgadbtic1ii4k8iljgere979d2o5dk";
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
  const title = decodeURIComponent(req.params.title || "").toLowerCase();

  const taskIndex = tasks.findIndex(t =>
    (t.title || "").toLowerCase().includes(title)
  );

  if (taskIndex === -1) {
    return res.status(404).json({ message: "Task not found" });
  }

  const deletedTask = tasks.splice(taskIndex, 1)[0];

  res.json({
    message: "Task deleted successfully",
    deletedTask
  });
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
app.get("/", (req, res) => {
  const total = tasks.length;
  const high = tasks.filter(t => (t.priority || "").toLowerCase().includes("high")).length;
  const completed = tasks.filter(t => (t.status || "").toLowerCase() === "completed").length;
  const analysis = latestAnalysis;
  const makeResult = latestMakeResult;
  const rows = tasks.map(task => `
    <tr>
      <td>${task.title}</td>
      <td>${task.status || "pending"}</td>
      <td>${task.priority || "-"}</td>
      <td>
        <a class="btn complete" href="/dashboard/complete/${encodeURIComponent(task.title)}">Complete</a>
        <a class="btn delete" href="/dashboard/delete/${encodeURIComponent(task.title)}">Delete</a>
      </td>
    </tr>
  `).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Adam Dashboard</title>
          <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <h1>Adam Executive Dashboard</h1>
      <p>AI Executive Assistant for Media Production Management</p>

      <div class="cards">
        <div class="card"><p>Total Tasks</p><h2>${total}</h2></div>
        <div class="card"><p>High Priority</p><h2>${high}</h2></div>
        <div class="card"><p>Completed</p><h2>${completed}</h2></div>
      </div>
      
<div class="panel">
  <h3>Executive Analysis Dashboard</h3>

  <div class="analysis-grid">
    <div class="analysis-box">
      <strong>Title</strong>
      ${analysis?.title || "No analysis saved yet"}
    </div>

    <div class="analysis-box status">
      <strong>Status</strong>
      ${analysis?.status || "-"}
    </div>

    <div class="analysis-box">
      <strong>Summary</strong>
      ${analysis?.summary || "-"}
    </div>

    <div class="analysis-box risk">
      <strong>Risks</strong>
      ${analysis?.risks || "-"}
    </div>

    <div class="analysis-box recommendation">
      <strong>Recommendations</strong>
      ${analysis?.recommendations || "-"}
    </div>
  </div>
</div>

<div class="panel">
  <h3>Make AI Routing Results</h3>

  <div class="analysis-grid">

    <div class="analysis-box">
      <strong>Department</strong>
      ${makeResult?.department || "No department detected"}
    </div>

    <div class="analysis-box status">
      <strong>Risk Level</strong>
      ${makeResult?.risk_level || "-"}
    </div>

    <div class="analysis-box">
      <strong>Summary</strong>
      ${makeResult?.summary || "-"}
    </div>

    <div class="analysis-box recommendation">
      <strong>Priority </strong>
      ${makeResult?.action_taken || "-"}
    </div>

  </div>
</div>


      <div class="panel">
        <h3>Add New Task</h3>
        <form method="POST" action="/dashboard/add">
          <input name="title" placeholder="Task title" required />
          <select name="priority">
            <option>High Priority</option>
            <option>Medium Priority</option>
            <option>Low Priority</option>
          </select>
          <select name="status">
            <option>pending</option>
            <option>completed</option>
          </select>
          <button type="submit">Add Task</button>
        </form>
      </div>
<div class="panel">
  <h3>Create Gmail Draft</h3>

  <form method="POST" action="/dashboard/gmail-draft">
    <input name="to" placeholder="Recipient email" required />
    <input name="subject" placeholder="Email subject" required />
    <br><br>
    <textarea name="body" placeholder="Email body" required style="width:100%; height:120px; padding:12px; border-radius:10px; border:1px solid #ccc;"></textarea>
    <br><br>
    <button type="submit">Save as Gmail Draft</button>
  </form>
</div>
      <table>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Actions</th>
        </tr>
        ${rows}
      </table>
    </body>
    </html>
  `);
});

app.post("/dashboard/add", (req, res) => {
  tasks.push({
    title: req.body.title,
    status: req.body.status || "pending",
    priority: req.body.priority || "Medium Priority"
  });

  res.redirect("/");
});

app.get("/dashboard/complete/:title", (req, res) => {
  const title = decodeURIComponent(req.params.title || "").toLowerCase();

  const task = tasks.find(t =>
    (t.title || "").toLowerCase().includes(title)
  );

  if (task) {
    task.status = "completed";
  }

  res.redirect("/");
});

app.get("/dashboard/delete/:title", (req, res) => {
  const title = decodeURIComponent(req.params.title || "").toLowerCase();

  const index = tasks.findIndex(t =>
    (t.title || "").toLowerCase().includes(title)
  );

  if (index !== -1) {
    tasks.splice(index, 1);
  }

  res.redirect("/");
});

app.post("/dashboard/gmail-draft", async (req, res) => {
  if (!gmailTokens) {
    return res.send(`
      <h2>Gmail is not connected</h2>
      <p>Please connect Gmail first.</p>
      <a href="/auth/google">Connect Gmail</a>
      <br><br>
      <a href="/">Back to Dashboard</a>
    `);
  }

  try {
    oauth2Client.setCredentials(gmailTokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

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

    emailDrafts.unshift({
      id: draft.data.id,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
      source: "Dashboard"
    });

    res.send(`
      <h2>Gmail draft created successfully ✅</h2>
      <p>The draft was saved in Gmail Drafts.</p>
      <a href="/">Back to Dashboard</a>
    `);

  } catch (error) {
    res.send(`
      <h2>Failed to create Gmail draft ❌</h2>
      <p>${error.message}</p>
      <a href="/">Back to Dashboard</a>
    `);
  }
});

app.get("/api/latest-draft", (req, res) => {
  if (!emailDrafts.length) {
    return res.json({
      message: "No drafts found"
    });
  }

  res.json(emailDrafts[0]);
});
app.post("/api/analysis", (req, res) => {
  latestAnalysis = {
    title: req.body.title || "Executive Analysis",
    summary: req.body.summary || "",
    risks: req.body.risks || "",
    recommendations: req.body.recommendations || "",
    status: req.body.status || "Needs Review",
    createdAt: new Date().toISOString()
  };

  res.json({
    message: "Analysis saved successfully",
    analysis: latestAnalysis
  });
});

app.get("/api/analysis", (req, res) => {
  if (!latestAnalysis) {
    return res.json({
      message: "No analysis saved yet"
    });
  }

  res.json(latestAnalysis);
});



app.post("/api/send-to-make", async (req, res) => {
  try {
    const issue = req.body.issue || req.body.message;

    if (!issue) {
      return res.status(400).json({
        message: "No issue provided"
      });
    }

    await axios.post(MAKE_WEBHOOK, {
      issue: issue
    });

    res.json({
      message: "Issue sent to Make successfully",
      sentIssue: issue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to send issue to Make",
      error: error.message
    });
  }
});


app.post("/api/make-result", (req, res) => {
  latestMakeResult = {
  department: req.body.department || req.body.Department || "Unknown",
  risk_level: req.body.risk || req.body.Risk || "-",
  summary: req.body.summary || req.body.Summary || "",
  action_taken: req.body.priority || req.body.Priority || "-",
    createdAt: new Date().toISOString()
  };

  res.json({
    message: "Make result saved",
    result: latestMakeResult
  });

});


app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
