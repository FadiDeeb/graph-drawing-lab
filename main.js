const { app, BrowserWindow } = require("electron");
const path = require("path");
function createWindow() {
    const win = new BrowserWindow({
        webPreferences: { preload: path.join(__dirname, "preload.js") }
    });

    win.loadFile("index.html");
}

app.on("ready", createWindow);