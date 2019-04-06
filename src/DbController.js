const dbController = {
    createDb: (db) => {
        db.run('CREATE TABLE IF NOT EXISTS audiofiles (id INTEGER PRIMARY KEY, date text, name text, wavdata text)');
    },
    getSounds: (db, callback) => {
        db.all('SELECT id, date, name, wavdata FROM audiofiles ORDER BY date DESC', callback);
    },
    insertSound: (db, date, wavdata) => {
        db.run('INSERT INTO audiofiles (date, wavdata) VALUES (?, ?)', date, wavdata);
    },
    deleteSound: (db, id) => {
        db.run('DELETE FROM audiofiles WHERE id = ?', id);
    }
}
export default dbController;