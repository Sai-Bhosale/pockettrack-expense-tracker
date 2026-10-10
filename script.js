
const STORAGE_KEY = "pockettrack_expenses";

const form = document.getElementById("expenseForm");
const titleInput = document.getElementById("expenseTitle");
const amountInput = document.getElementById("expenseAmount");
const dateInput = document.getElementById("expenseDate");
const categoryInput = document.getElementById("expenseCategory");
const noteInput = document.getElementById("expenseNote");
const monthFilter = document.getElementById("monthFilter");
const searchInput = document.getElementById("searchExpenses");
const expenseList = document.getElementById("expenseList");
const emptyState = document.getElementById("emptyState");
const formMessage = document.getElementById("formMessage");
const exportButton = document.getElementById("exportButton");

const totalExpenses = document.getElementById("totalExpenses");
const transactionCount = document.getElementById("transactionCount");
const biggestExpense = document.getElementById("biggestExpense");
const biggestCategory = document.getElementById("biggestCategory");
const chartMessage = document.getElementById("chartMessage");

let expenses = loadExpenses();
let expenseChart = null;

function loadExpenses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

dateInput.value = getLocalDate();
monthFilter.value = getLocalDate().slice(0, 7);

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function getFilteredExpenses() {
  const selectedMonth = monthFilter.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

  return expenses
    .filter((expense) => !selectedMonth || expense.date.startsWith(selectedMonth))
    .filter((expense) => {
      const searchableText =
        `${expense.title} ${expense.category} ${expense.note || ""}`.toLowerCase();
      return searchableText.includes(searchTerm);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function renderExpenses() {
  const filtered = getFilteredExpenses();
  expenseList.replaceChildren();

  filtered.forEach((expense) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = expense.date;

    const titleCell = document.createElement("td");
    titleCell.textContent = expense.title;

    const categoryCell = document.createElement("td");
    categoryCell.textContent = expense.category;

    const amountCell = document.createElement("td");
    amountCell.textContent = formatMoney(expense.amount);

    const noteCell = document.createElement("td");
    noteCell.textContent = expense.note || "—";

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete expense: ${expense.title}`);

    deleteButton.addEventListener("click", () => {
      if (confirm(`Delete "${expense.title}"?`)) {
        expenses = expenses.filter((item) => item.id !== expense.id);
        saveExpenses();
        renderAll();
        formMessage.textContent = "Expense deleted.";
      }
    });

    actionCell.appendChild(deleteButton);
    row.append(dateCell, titleCell, categoryCell, amountCell, noteCell, actionCell);
    expenseList.appendChild(row);
  });

  emptyState.hidden = filtered.length > 0;
  updateSummary(filtered);
  updateChart(filtered);
}

function updateSummary(filtered) {
  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  totalExpenses.textContent = formatMoney(total);
  transactionCount.textContent = String(filtered.length);

  const largest = filtered.reduce(
    (best, expense) => (!best || expense.amount > best.amount ? expense : best),
    null
  );

  biggestExpense.textContent = largest ? formatMoney(largest.amount) : formatMoney(0);
  biggestCategory.textContent = largest ? largest.category : "—";
}

function updateChart(filtered) {
  const totals = {};

  filtered.forEach((expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  });

  const labels = Object.keys(totals);
  const values = labels.map((label) => totals[label]);

  if (typeof Chart === "undefined") {
    chartMessage.textContent =
      "The chart needs an internet connection to load. Your expenses still work.";
    return;
  }

  chartMessage.textContent = labels.length ? "" : "Add an expense to see your chart.";

  const canvas = document.getElementById("expenseChart");
  if (!canvas) return;

  if (expenseChart) {
    expenseChart.destroy();
  }

  expenseChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#4f46e5", "#0d9488", "#f59e0b", "#e11d48",
          "#7c3aed", "#0284c7", "#65a30d", "#ea580c"
        ],
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${formatMoney(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;
  const category = categoryInput.value;
  const note = noteInput.value.trim();

  if (!title || !Number.isFinite(amount) || amount <= 0 || !date || !category) {
    formMessage.textContent = "Please enter a title, valid amount, date, and category.";
    return;
  }

  expenses.push({
    id: Date.now() + Math.random(),
    title,
    amount,
    date,
    category,
    note
  });

  try {
    saveExpenses();
  } catch {
    expenses.pop();
    formMessage.textContent = "Could not save the expense. Check your browser storage.";
    return;
  }

  form.reset();
  dateInput.value = getLocalDate();
  monthFilter.value = date.slice(0, 7);
  searchInput.value = "";
  formMessage.textContent = "Expense added successfully.";
  renderAll();
});

monthFilter.addEventListener("change", renderAll);
searchInput.addEventListener("input", renderAll);

exportButton.addEventListener("click", () => {
  const filtered = getFilteredExpenses();

  if (!filtered.length) {
    formMessage.textContent = "There are no expenses to export.";
    return;
  }

  const headers = ["Date", "Title", "Category", "Amount (INR)", "Note"];
  const rows = filtered.map((expense) => [
    expense.date,
    expense.title,
    expense.category,
    expense.amount,
    expense.note || ""
  ]);

  const escapeCSV = (value) =>
    `"${String(value).replace(/"/g, '""')}"`;

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pockettrack-expenses.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  formMessage.textContent = "CSV file exported.";
});

function renderAll() {
  renderExpenses();
}

renderAll();
