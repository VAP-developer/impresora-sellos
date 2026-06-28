import { Mongo } from 'meteor/mongo';

export const Images = new Mongo.Collection("images");

Images.allow({
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