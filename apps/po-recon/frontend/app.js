const normaliseBase = (value) => (value ? value.replace(/\/+$/, "") : "");
const determineApiBase = () => {
  if (window.PO_RECON_API_BASE) {
    return normaliseBase(window.PO_RECON_API_BASE);
  }
  const meta = document.querySelector('meta[name="po-recon-api-base"]');
  if (meta && meta.content) {
    return normaliseBase(meta.content);
  }
  return normaliseBase(window.location.origin);
};

const API_BASE = determineApiBase();

const apiRequest = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.detail || data?.error || response.statusText;
      throw new Error(message || "Request failed");
    }
    return { ok: true, data };
  } catch (error) {
    console.error("API request failed", path, error);
    return { ok: false, data: { error: error.message } };
  }
};

const authEmail = document.querySelector("#auth-email");
const authMethod = document.querySelector("#auth-method");
const loginBtn = document.querySelector("#login-btn");
const authResult = document.querySelector("#auth-result");

const contractForm = document.querySelector("#contract-form");
const contractResult = document.querySelector("#contract-result");
const contractsTable = document.querySelector("#contracts-table");
const refreshContractsBtn = document.querySelector("#refresh-contracts");

const poForm = document.querySelector("#po-form");
const poItemsContainer = document.querySelector("#po-items");
const addPoItemBtn = document.querySelector("#add-po-item");
const poResult = document.querySelector("#po-result");
const posTable = document.querySelector("#pos-table");
const refreshPosBtn = document.querySelector("#refresh-pos");

const invoiceForm = document.querySelector("#invoice-form");
const invoiceItemsContainer = document.querySelector("#invoice-items");
const addInvoiceItemBtn = document.querySelector("#add-invoice-item");
const invoiceUploadForm = document.querySelector("#invoice-upload-form");
const invoiceResult = document.querySelector("#invoice-result");
const invoicesTable = document.querySelector("#invoices-table");
const refreshInvoicesBtn = document.querySelector("#refresh-invoices");

const dashboardTable = document.querySelector("#dashboard-table");
const refreshDashboardBtn = document.querySelector("#refresh-dashboard");
const llmOutputEl = document.querySelector("#llm-output");

let sessionToken = null;

const renderTable = (tableEl, items) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    tableEl.innerHTML = "<caption>No records found.</caption>";
    return;
  }

  const headers = Object.keys(list[0]);
  const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${list
    .map(
      (item) =>
        `<tr>${headers
          .map((h) => `<td>${typeof item[h] === "object" ? JSON.stringify(item[h]) : item[h]}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody>`;
  tableEl.innerHTML = thead + tbody;
};

const notify = (target, data) => {
  target.textContent = JSON.stringify(data, null, 2);
};

const buildItemRow = (container, prefix) => {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input placeholder="Description" name="${prefix}-description" required />
    <input placeholder="Quantity" name="${prefix}-quantity" type="number" step="0.01" required />
    <input placeholder="Rate" name="${prefix}-rate" type="number" step="0.01" required />
    <button type="button" class="remove-item">Remove</button>
  `;
  row.querySelector(".remove-item").addEventListener("click", () => row.remove());
  container.appendChild(row);
};

const gatherItems = (container, prefix) => {
  const rows = container.querySelectorAll(".item-row");
  return Array.from(rows).map((row) => {
    const [description, quantity, rate] = row.querySelectorAll("input");
    return {
      description: description.value,
      quantity: Number(quantity.value),
      rate: Number(rate.value),
    };
  });
};

loginBtn.addEventListener("click", async () => {
  if (!authEmail.value) {
    notify(authResult, { error: "Email required" });
    return;
  }
  const params = new URLSearchParams({ email: authEmail.value, method: authMethod.value });
  const { ok, data } = await apiRequest(`/api/auth/login?${params.toString()}`);
  if (ok) {
    sessionToken = data.token;
  }
  notify(authResult, data);
});

contractForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(contractForm);
  const { data } = await apiRequest("/api/contracts/upload", {
    method: "POST",
    body: formData,
  });
  notify(contractResult, data);
  refreshContracts();
});

const refreshContracts = async () => {
  const { data } = await apiRequest("/api/contracts");
  renderTable(contractsTable, data || []);
};

poForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const items = gatherItems(poItemsContainer, "po");
  if (!items.length) {
    notify(poResult, { error: "Add at least one PO item." });
    return;
  }

  const payload = {
    vendor_id: poForm.vendor_id.value,
    issue_date: new Date(poForm.issue_date.value).toISOString(),
    items,
  };

  const { data } = await apiRequest("/api/pos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notify(poResult, data);
  refreshPos();
});

const refreshPos = async () => {
  const { data } = await apiRequest("/api/pos");
  renderTable(posTable, data || []);
};

invoiceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const items = gatherItems(invoiceItemsContainer, "invoice");
  if (!items.length) {
    notify(invoiceResult, { error: "Add at least one invoice item." });
    return;
  }

  const payload = {
    invoice_id: invoiceForm.invoice_id.value,
    vendor_id: invoiceForm.vendor_id.value,
    linked_po_id: invoiceForm.linked_po_id.value,
    received_date: new Date(invoiceForm.received_date.value).toISOString(),
    file_type: "pdf",
    file_url: "manual-entry",
    items,
  };

  const { data } = await apiRequest("/api/invoices/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  notify(invoiceResult, data);
  refreshInvoices();
});

invoiceUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(invoiceUploadForm);
  const { data } = await apiRequest("/api/invoices/upload", {
    method: "POST",
    body: formData,
  });
  notify(invoiceResult, data);
  refreshInvoices();
});

const refreshInvoices = async () => {
  const { data } = await apiRequest("/api/invoices");
  renderTable(invoicesTable, data || []);
};

const refreshDashboard = async () => {
  const dashboardResponse = await apiRequest("/api/dashboard");
  if (dashboardResponse.data?.data) {
    renderTable(dashboardTable, dashboardResponse.data.data);
  } else {
    renderTable(dashboardTable, []);
  }

  const llmResponse = await apiRequest("/api/llm-outputs");
  const llmData = llmResponse.data || [];
  llmOutputEl.innerHTML = llmData
    .map(
      (item) => `
        <article>
          <h4>Analysis ${item.analysis_id}</h4>
          <p><strong>PO:</strong> ${item.linked_po_id} — <strong>Invoice:</strong> ${item.linked_invoice_id}</p>
          <p>${item.summary || "No summary"}</p>
          <p><strong>Flagged:</strong> ${item.flagged_issues.join(", ") || "None"}</p>
          <p><strong>Recommendations:</strong> ${item.recommendations.join(", ") || "None"}</p>
        </article>
      `
    )
    .join("");
};

addPoItemBtn.addEventListener("click", () => buildItemRow(poItemsContainer, "po"));
addInvoiceItemBtn.addEventListener("click", () => buildItemRow(invoiceItemsContainer, "invoice"));
refreshContractsBtn.addEventListener("click", refreshContracts);
refreshPosBtn.addEventListener("click", refreshPos);
refreshInvoicesBtn.addEventListener("click", refreshInvoices);
refreshDashboardBtn.addEventListener("click", refreshDashboard);

// Initialize with one empty item row per form for usability
buildItemRow(poItemsContainer, "po");
buildItemRow(invoiceItemsContainer, "invoice");
refreshContracts();
refreshPos();
refreshInvoices();
refreshDashboard();
