import { Meteor } from 'meteor/meteor';
import { Images } from './collection';

// Publish all images (only Modelo1 and Modelo2 exist)
Meteor.publish('images', function () {
  return Images.find({});
});
