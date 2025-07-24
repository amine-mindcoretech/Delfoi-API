const odbc = require('odbc');
async function connectODBC() {
  const connection = await odbc.connect('DSN=GENIUS_READ;UID=genius_read;PWD=egeniusRD*;CHARSET=latin1;MARS_Connection=Yes;');
  return connection;
}
module.exports = { connectODBC };