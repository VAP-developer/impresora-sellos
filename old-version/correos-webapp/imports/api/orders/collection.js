import { Mongo } from 'meteor/mongo';

export const Orders = new Mongo.Collection("orders");

Orders.allow({
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