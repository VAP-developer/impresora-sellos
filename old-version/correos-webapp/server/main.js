import '../imports/api/config';
import '../imports/api/images';
import '../imports/api/orders';
import '../imports/api/server_methods';

import { Config } from '../imports/api/config/collection';

const count = await Config.find().countAsync();
if (count === 0) {
	await Meteor.callAsync("initConfig");
}