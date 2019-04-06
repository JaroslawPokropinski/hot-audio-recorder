import React, { Component } from "react";
import moment from "moment";
import "./App.css";
import dbController from "./DbController";
const remote = window.require("electron").remote;
const ipc = window.require("electron").ipcRenderer;
const { PythonShell } = remote.require("python-shell");
const sqlite3 = remote.require("sqlite3");

class App extends Component {
  state = {
    files: [],
    audio: "",
    audioController: undefined,
    db: new sqlite3.Database("db/example.db"),
    loading: false
  };
  // todo put audio object in state

  render() {
    const fileList = this.state.files.map(file => (
      <li key={file.id}>
        <span className="sound-date">{file.date}</span>
        <span>{file.name ? file.name : ""}</span>
        <button
          className="sound-del"
          onClick={e => this.onSoundDelete(e, file)}
        >
          Del
        </button>
        <button
          className="sound-play"
          onClick={e => this.onSoundClick(e, file)}
        >
          Play
        </button>
      </li>
    ));
    return (
      <div className="App">
        <ul className="sound-list">{fileList}</ul>
        {(this.state.loading)?<div className="curtain"><div class="lds-ring"><div></div><div></div><div></div><div></div></div></div>:''}
        <audio controls src={this.state.audio ? this.state.audio : ""} />
      </div>
    );
  }

  componentDidMount() {
    const pyshell = new PythonShell("python/recorder.py");
    // create table if it is not present
    dbController.createDb(this.state.db);
    dbController.getSounds(this.state.db, (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      this.setState({ files: rows });
    });

    pyshell.on("message", message => {
      const date = moment().format("YYYY-MM-DD HH:mm:ss");
      dbController.insertSound(this.state.db, date, message);
      dbController.getSounds(this.state.db, (err, rows) => {
        if (err) {
          console.error(err);
          return;
        }
        this.setState({ files: rows, loading: false });
      });
    });

    pyshell.on("stderr", function(message) {
      console.error("Err: ", message);
    });

    pyshell.on("close", function(message) {
      console.error("Close: ", message);
    });
    ipc.send("addHotkey", "CmdOrCtrl+R");
    ipc.on("onHotkey", (event, arg) => {
      if (arg === "CmdOrCtrl+R" && !this.state.loading) {
        this.setState({loading: true})
        ipc.send("log", "Record new sound");
        pyshell.send("s");
      }
    });
  }

  componentWillUnmount() {
    remote.globalShortcut.unregisterAll();
  }

  onSoundClick(e, file) {
    const dataUri = `data:audio/mp3;base64,${file.wavdata}`;
    this.setState({ audio: dataUri });
  }
  onSoundDelete(e, file) {
    dbController.deleteSound(this.state.db, file.id);
    ipc.send("log", `id: ${file.id} date: ${file.date}`);
    dbController.getSounds(this.state.db, (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      this.setState({ files: rows });
    });
  }
}

export default App;
