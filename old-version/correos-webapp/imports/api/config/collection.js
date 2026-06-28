import { Mongo } from 'meteor/mongo';

export const Config = new Mongo.Collection("config");

Config.allow({
  insert() {
    return true;
  },
  update() {
    return true;
  },
  remove() {
    return true;
  }
});