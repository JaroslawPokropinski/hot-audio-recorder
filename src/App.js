import React, { Component } from 'react';
import moment from 'moment';
import './App.css';
import dbController from './DbController';
const remote = window.require('electron').remote;
const ipc = window.require('electron').ipcRenderer;
const { spawn } = remote.require('child_process');
const sqlite3 = remote.require('sqlite3');

class App extends Component {
  state = {
    files: [],
    audio: "",
    audioController: undefined,
    db: new sqlite3.Database('db/example.db'),
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
        {this.state.loading ? (
          <div className="curtain">
            <div className="lds-ring">
              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
        ) : (
          ""
        )}
        <audio controls src={this.state.audio ? this.state.audio : ""} />
      </div>
    );
  }

  componentDidMount() {
    // windows:
    // const pyprocess = spawn('python/recorder.exe')
    // portable:
    const pyprocess = spawn('python', ['python/recorder.py'])
    // create table if it is not present
    dbController.createDb(this.state.db);
    dbController.getSounds(this.state.db, (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      this.setState({ files: rows });
    });

    pyprocess.stdout.on("data", b64data => {
      ipc.send("log", `msg: ${(b64data.length < 100)?b64data:b64data.slice(0, 100) + "..."}`);
      if (b64data.length <= 1) {
        this.setState({ loading: false });
        return;
      }
      const date = moment().format("YYYY-MM-DD HH:mm:ss");
      dbController.insertSound(this.state.db, date, b64data);

      
      dbController.getSounds(this.state.db, (err, rows) => {
        if (err) {
          ipc.send("log", `sqlerr: ${err}`);
          return;
        }
        this.setState({ files: rows, loading: false });
      });
    });

    pyprocess.stderr.on("data", (message) => {
      ipc.send("log", `err: ${(message.length < 100)?message:message.slice(0, 100) + "..."}`);
    });

    pyprocess.on("close", (code) => {
      ipc.send("log", `exited with: ${code}`);
    });
    
    ipc.send("addHotkey", "CmdOrCtrl+R");
    ipc.on("onHotkey", (event, arg) => {
      if (arg === "CmdOrCtrl+R" && !this.state.loading) {
        this.setState({ loading: true });
        ipc.send("log", "Record new sound");
        pyprocess.stdin.write('s\n')
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
    ipc.send("log", `delete: {id: ${file.id}, date: ${file.date}}`);
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
