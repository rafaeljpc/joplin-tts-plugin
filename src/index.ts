import joplin from 'api';
import { start } from './plugin';

joplin.plugins.register({
	onStart: start,
});
