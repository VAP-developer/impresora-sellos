import { Meteor } from 'meteor/meteor';
import { Orders } from './collection';

async function insertOrder(orders) {
  for (let i = 0; i < orders.length; i++) {
    await Orders.insertAsync(orders[i]);
  }
}

/**
 * Converts an array of objects to CSV string.
 * Replaces the unmaintained lfergon:exportcsv atmosphere package.
 */
function collectionToCSV(data, { heading = true, delimiter = ',' } = {}) {
  if (!data || data.length === 0) return '';

  const keys = Object.keys(data[0]).filter(k => k !== '_id');
  const lines = [];

  if (heading) {
    lines.push(keys.join(delimiter));
  }

  for (const doc of data) {
    const values = keys.map(key => {
      const val = doc[key];
      if (val == null) return '';
      const str = String(val);
      // Escape values containing delimiter, quotes, or newlines
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

async function downloadXLS() {
  const collection = await Orders.find().fetchAsync();
  const heading = true;
  const delimiter = ";";
  return collectionToCSV(collection, { heading, delimiter });
}

Meteor.methods({
  insertOrder,
  downloadXLS
});
