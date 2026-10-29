const brands = [
  { name: "MCM", mark: "MCM", logo: "mcm", round: true },
  { name: "Nike", mark: "Nike", logo: "nike" },
  { name: "adidas", mark: "adidas", logo: "adidas" },
  { name: "Louis Vuitton", mark: "LV", logo: "lv", round: true },
  { name: "GAP", mark: "GAP", logo: "gap", round: true },
  { name: "Chanel", mark: "CC", logo: "chanel" },
  { name: "PUMA", mark: "PUMA", logo: "puma" },
  { name: "The North Face", mark: "THE<br>NORTH<br>FACE", logo: "northface", round: true },
  { name: "GUCCI", mark: "GG", logo: "gucci", round: true },
  { name: "PRADA", mark: "PRADA", logo: "prada" },
  { name: "GUESS", mark: "GUESS", logo: "guess" },
  { name: "Playboy", mark: "P", logo: "playboy", round: true },
];

const brandGrid = document.querySelector("#brand-grid");
const storesHeading = document.querySelector("#stores-heading");
const storeDescription = document.querySelector("#store-description");
const toast = document.querySelector("#toast");
let selectedBrand = "";
let toastTimeout;

function makeAdidasMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 32 28");
  svg.setAttribute("aria-hidden", "true");

  [
    "M14 3 18 1l13 22h-7L12 4Z",
    "M7 10 11 8l9 15h-7L5 11Z",
    "M1 17l4-2 5 8H3Z",
  ].forEach((shape) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", shape);
    svg.append(path);
  });
  return svg;
}

function makeNikeMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 36");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 24.5 57 3 24 30c-7 5-17 3-21-5.5Z");
  svg.append(path);
  return svg;
}

function makeLogo(brand) {
  const logo = document.createElement("span");
  logo.className = `brand-logo brand-logo--${brand.logo}${brand.round ? " brand-logo--round" : ""}`;
  logo.setAttribute("aria-hidden", "true");

  if (brand.logo === "nike") {
    logo.append(makeNikeMark());
  } else if (brand.logo === "adidas") {
    logo.append(makeAdidasMark());
    const wordmark = document.createElement("span");
    wordmark.textContent = brand.mark;
    logo.append(wordmark);
  } else if (brand.logo === "chanel") {
    const initials = document.createElement("span");
    initials.textContent = brand.mark;
    const wordmark = document.createElement("small");
    wordmark.textContent = "CHANEL";
    logo.append(initials, wordmark);
  } else if (brand.logo === "northface") {
    ["THE", "NORTH", "FACE"].forEach((line) => {
      const word = document.createElement("span");
      word.textContent = line;
      logo.append(word);
    });
  } else {
    logo.textContent = brand.mark;
  }
  return logo;
}

function renderBrands() {
  brandGrid.replaceChildren(
    ...brands.map((brand) => {
      const button = document.createElement("button");
      button.className = `brand-card${selectedBrand === brand.name ? " is-selected" : ""}`;
      button.type = "button";
      button.setAttribute("aria-pressed", String(selectedBrand === brand.name));
      button.setAttribute("aria-label", brand.name);
      button.append(makeLogo(brand));
      button.addEventListener("click", () => selectBrand(brand));
      return button;
    }),
  );
}

function selectBrand(brand) {
  selectedBrand = selectedBrand === brand.name ? "" : brand.name;
  storesHeading.textContent = selectedBrand ? `${brand.name} stores` : "ThrfT stores";
  storeDescription.textContent = selectedBrand
    ? `Discover pre-loved ${brand.name} from independent stores.`
    : "";
  renderBrands();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => {
      const isCurrent = item === button;
      item.classList.toggle("is-current", isCurrent);
      if (isCurrent) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    if (button.dataset.page === "Start") {
      showToast("You’re already on the ThrfT home screen.");
    } else {
      showToast(`${button.dataset.page} is coming soon.`);
    }
  });
});

renderBrands();
