const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/romeo/BIBLEPLUS/Bibleplus/Assets/bibleplus.db');
db.all("SELECT * FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) throw err;
  console.log("Tables:", rows.map(r => r.name));
});
db.all("SELECT count(*) as count FROM Cantiques", [], (err, rows) => {
  if (err) {
    console.log("Cantiques table error:", err.message);
  } else {
    console.log("Cantiques count:", rows[0].count);
    if (rows[0].count > 0) {
      db.all("SELECT * FROM Cantiques LIMIT 5", [], (err, sample) => {
        console.log("Sample:", sample);
      });
    }
  }
});
db.close();
