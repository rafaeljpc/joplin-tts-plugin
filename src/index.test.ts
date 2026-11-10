import joplin from 'api';
import { start } from './plugin';

describe('index', () => {
	it('registers the plugin with the start handler', () => {
		require('./index');
		const register = (joplin as unknown as { plugins: { register: jest.Mock } }).plugins.register;
		expect(register).toHaveBeenCalledWith({ onStart: start });
	});
});
