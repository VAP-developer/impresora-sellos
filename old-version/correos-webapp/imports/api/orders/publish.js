import { Meteor } from 'meteor/meteor';

import { Orders } from './collection';

if (Meteor.isServer) {
  Meteor.publish("orders", async function (query) {
    if (query) {
      return Orders.find(query.selector, query.options);
    } else {
      return Orders.find();
    }
  });
}
