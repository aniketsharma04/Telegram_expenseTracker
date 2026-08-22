/**
 * Updates the bot's command menu (the "/" button in Telegram).
 * Run after deploying new commands:  npm run set-commands
 * Needs TELEGRAM_BOT_TOKEN in the environment (or .env.local values exported).
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN first.");
  process.exit(1);
}

const commands = [
  { command: "expense", description: "Spent this month" },
  { command: "budget", description: "Budgets — /budget 15000 or /budget groceries 3000" },
  { command: "income", description: "Log income / see savings — /income 50000 salary" },
  { command: "split", description: "Split a bill with family — /split 1200 dinner" },
  { command: "bills", description: "What's due this month" },
  { command: "paid", description: "Mark a bill paid — /paid electricity 1234" },
  { command: "family", description: "Family report / create a family" },
  { command: "invite", description: "Invite link for your family" },
  { command: "invest", description: "Invested this month" },
  { command: "emi", description: "Loans & EMI this month" },
  { command: "undo", description: "Delete the last entry" },
  { command: "last", description: "Show the last entry" },
  { command: "category", description: "Fix the last entry's category" },
  { command: "amount", description: "Fix the last entry's amount" },
  { command: "dashboard", description: "Open your web dashboard" },
  { command: "app", description: "Login code for the mobile app" },
  { command: "status", description: "Bot health check" },
  { command: "help", description: "How to log expenses" },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ commands }),
});
console.log(JSON.stringify(await res.json(), null, 2));
