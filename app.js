const brands = [
  { name: "MCM", category: "Designer", style: "caps", stores: 18 },
  { name: "Nike", category: "Streetwear", style: "bold", stores: 42 },
  { name: "Louis Vuitton", category: "Designer", style: "caps", stores: 26 },
  { name: "adidas", category: "Streetwear", style: "bold", stores: 31 },
  { name: "GAP", category: "Everyday", style: "caps", stores: 15 },
  { name: "CHANEL", category: "Designer", style: "caps", stores: 12 },
  { name: "PUMA", category: "Streetwear", style: "bold", stores: 23 },
  { name: "The North Face", category: "Streetwear", style: "bold", stores: 19 },
  { name: "PRADA", category: "Designer", style: "caps", stores: 14 },
  { name: "GUCCI", category: "Designer", style: "caps", stores: 21 },
  { name: "GUESS", category: "Everyday", style: "bold", stores: 17 },
  { name: "Playboy", category: "Everyday", style: "caps", stores: 9 },
];

const brandGrid = document.querySelector("#brand-grid");
const searchInput = document.querySelector("#brand-search");
const emptyState = document.querySelector("#empty-state");
const categoryButtons = [...document.querySelectorAll(".filter-chip")];
const storesHeading = document.querySelector("#stores-heading");
const storeDescription = document.querySelector("#store-description");
const toast = document.querySelector("#toast");
let activeCategory = "All";
let selectedBrand = "";
let toastTimeout;

function renderBrands() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleBrands = brands.filter((brand) => {
    const matchesCategory = activeCategory === "All" || brand.category === activeCategory;
    const matchesQuery = brand.name.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  brandGrid.replaceChildren(
    ...visibleBrands.map((brand) => {
      const button = document.createElement("button");
      button.className = `brand-card${selectedBrand === brand.name ? " is-selected" : ""}`;
      button.type = "button";
      button.setAttribute("aria-pressed", String(selectedBrand === brand.name));
      button.setAttribute("aria-label", `${brand.name}, ${brand.stores} stores`);

      const label = document.createElement("span");
      label.className = "brand-name";
      label.dataset.style = brand.style;
      label.textContent = brand.name;

      const storeCount = document.createElement("small");
      storeCount.textContent = `${brand.stores} stores`;
      button.append(label, storeCount);
      button.addEventListener("click", () => selectBrand(brand));
      return button;
    }),
  );
  emptyState.hidden = visibleBrands.length > 0;
}

function selectBrand(brand) {
  selectedBrand = selectedBrand === brand.name ? "" : brand.name;
  storesHeading.textContent = selectedBrand ? `${brand.name} stores` : "ThrfT stores";
  storeDescription.textContent = selectedBrand
    ? `${brand.stores} curated closets with pre-loved ${brand.name} finds.`
    : "Independent closets. Exceptional finds. All in one place.";
  renderBrands();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    renderBrands();
  });
});

searchInput.addEventListener("input", renderBrands);
document.querySelector("#view-all").addEventListener("click", () => {
  activeCategory = "All";
  searchInput.value = "";
  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === "All";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderBrands();
});
document.querySelector("#explore-stores").addEventListener("click", () => {
  document.querySelector("#stores").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("More independent stores are coming soon.");
});
document.querySelector(".bag-button").addEventListener("click", () => {
  showToast("Your bag is empty. Find a one-of-a-kind piece to get started.");
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => {
      const isCurrent = item === button;
      item.classList.toggle("is-current", isCurrent);
      if (isCurrent) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    if (button.dataset.page === "Search") {
      searchInput.focus();
      document.querySelector(".browse-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (button.dataset.page !== "Discover") {
      showToast(`${button.dataset.page} is coming soon.`);
    } else {
      document.querySelector("#home").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape") searchInput.blur();
});

renderBrands();
