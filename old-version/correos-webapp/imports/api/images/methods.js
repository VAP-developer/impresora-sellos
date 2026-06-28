import { Meteor } from 'meteor/meteor';
import { Images } from './collection';

/**
 * Remove all images with the given name, then insert a new one
 * with the base64 data URI stored directly in the document.
 */
async function removeImagesWithName(name) {
  await Images.removeAsync({ name: name });
}

async function uploadImageBase64(name, dataUri, type, size) {
  // Remove existing image with same name
  await Images.removeAsync({ name: name });

  // Insert new image document with data URI directly
  await Images.insertAsync({
    name: name,
    type: type,
    size: size,
    url: dataUri,
    createdAt: new Date(),
  });
}

Meteor.methods({
  removeImagesWithName,
  uploadImageBase64,
});
