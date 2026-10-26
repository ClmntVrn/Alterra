// Pilote Chrome ou Edge sans dépendance, par le protocole DevTools, pour les tests navigateur.
// Le site est servi localement depuis la racine du dépôt, sur un port libre.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { delimiter, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BLANK_PAGE = "/__vide.html";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const BROWSER_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
];
const BROWSER_COMMANDS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

const sleep = ms => new Promise(done => setTimeout(done, ms));

/** Chemin du navigateur : variable CHROME_PATH, emplacements connus, puis commandes du PATH. */
export function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const known = BROWSER_PATHS.find(path => existsSync(path));
  if (known) return known;
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    const command = BROWSER_COMMANDS.find(name => existsSync(join(directory, name)));
    if (command) return join(directory, command);
  }
  throw new Error("Aucun Chrome ni Edge trouvé : indique son chemin dans la variable CHROME_PATH.");
}

function startServer() {
  const server = createServer(async (request, response) => {
    let path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (path === BLANK_PAGE) {
      response.writeHead(200, { "content-type": CONTENT_TYPES[".html"] });
      response.end("<!doctype html><title>Vide</title>");
      return;
    }
    if (path === "/") path = "/index.html";
    const file = resolve(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(file)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise(done => server.listen(0, "127.0.0.1", () => done(server)));
}

async function waitForDevToolsPort(profile, browser) {
  const file = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (browser.exitCode !== null) throw new Error("Le navigateur s’est arrêté au démarrage.");
    if (existsSync(file)) {
      const [port] = readFileSync(file, "utf8").split("\n");
      if (port) return Number(port);
    }
    await sleep(100);
  }
  throw new Error("Le navigateur n’a pas ouvert son port DevTools.");
}

class Page {
  #socket;
  #nextId = 0;
  #pending = new Map();
  #listeners = new Set();
  #hoveredNodes = new Map();

  constructor(socket, origin) {
    this.#socket = socket;
    this.origin = origin;
    /** Erreurs JavaScript et `console.error` de la page. */
    this.errors = [];
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        this.#pending.get(message.id)?.(message);
        this.#pending.delete(message.id);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        this.errors.push(details.exception?.description || details.text);
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(" "));
      }
      for (const listener of this.#listeners) listener(message);
    });
  }

  /** Commande brute du protocole DevTools. */
  send(method, params = {}) {
    const id = ++this.#nextId;
    return new Promise((done, fail) => {
      this.#pending.set(id, message =>
        message.error
          ? fail(new Error(`${method} : ${message.error.message}`))
          : done(message.result)
      );
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  #nextEvent(method) {
    return new Promise(done => {
      const listener = message => {
        if (message.method !== method) return;
        this.#listeners.delete(listener);
        done(message.params);
      };
      this.#listeners.add(listener);
    });
  }

  /** Ouvre un chemin du site et attend la fin du chargement. */
  async goto(path) {
    const loaded = this.#nextEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url: new URL(path, this.origin).href });
    await loaded;
  }

  /** Page vide du même site, pour préparer la base locale avant le lancement de l’application. */
  gotoBlank() {
    return this.goto(BLANK_PAGE);
  }

  /**
   * Exécute une fonction dans la page et renvoie son résultat (sérialisable en JSON).
   * La fonction ne voit pas les variables du test : on lui passe ses valeurs en arguments.
   */
  async evaluate(fn, ...args) {
    const expression = `(${fn})(...${JSON.stringify(args)})`;
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    }
    return result.value;
  }

  /** Attend qu’une fonction de la page renvoie une valeur vraie, et la renvoie. */
  async waitFor(fn, { timeout = 5000, message = "Condition non remplie à temps." } = {}, ...args) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = await this.evaluate(fn, ...args);
      if (value) return value;
      if (Date.now() > deadline) throw new Error(message);
      await sleep(50);
    }
  }

  /** Taille d’écran mobile ; `touch` simule un écran tactile, sans survol. */
  async setViewport(width, height = 812, { touch = false } = {}) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await this.send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: 5 });
  }

  /** Force l’état :hover de l’élément désigné, comme un survol resté actif après un toucher. */
  async forceHover(selector, enabled = true) {
    // Un nouveau DOM.getDocument renumérote les nœuds : on garde celui déjà forcé pour l’annuler.
    let nodeId = this.#hoveredNodes.get(selector);
    if (!nodeId) {
      await this.send("DOM.enable");
      await this.send("CSS.enable");
      const { root } = await this.send("DOM.getDocument");
      ({ nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector }));
    }
    if (enabled) this.#hoveredNodes.set(selector, nodeId);
    else this.#hoveredNodes.delete(selector);
    await this.send("CSS.forcePseudoState", {
      nodeId,
      forcedPseudoClasses: enabled ? ["hover"] : []
    });
  }

  /** Toucher au centre de l’élément désigné par le sélecteur. */
  async tap(selector) {
    const point = await this.evaluate(selector => {
      const element = document.querySelector(selector);
      element.scrollIntoView({ block: "center", behavior: "instant" });
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }, selector);
    await this.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
}

/**
 * Lance un navigateur sans interface avec un profil vierge.
 * @returns {Promise<{ page: Page, close: () => Promise<void> }>}
 */
export async function launchBrowser({ width = 375, height = 812 } = {}) {
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), "alterra-navigateur-"));
  const browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "about:blank"
    ],
    { stdio: "ignore" }
  );
  const exited = new Promise(done => browser.once("exit", done));

  async function close() {
    browser.kill();
    await Promise.race([exited, sleep(3000)]);
    await new Promise(done => server.close(done));
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Profil temporaire encore verrouillé : le système le nettoiera.
    }
  }

  try {
    const port = await waitForDevToolsPort(profile, browser);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(entry => entry.type === "page");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, fail) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", fail, { once: true });
    });
    const page = new Page(socket, origin);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    // Sans interface, la page n’a jamais le focus et :focus ne s’applique pas : on l’émule.
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await page.setViewport(width, height);
    return {
      page,
      close: async () => {
        socket.close();
        await close();
      }
    };
  } catch (error) {
    await close();
    throw error;
  }
}
