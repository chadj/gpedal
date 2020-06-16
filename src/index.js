import {registerUI} from './ui';

document.addEventListener('DOMContentLoaded', () => {
  registerUI().catch(console.error);
});
