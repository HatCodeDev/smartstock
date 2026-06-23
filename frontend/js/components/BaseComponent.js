/**
 * BaseComponent - A lightweight base class for component-based UI without frameworks.
 */
export default class BaseComponent {
  /**
   * @param {Object} props - Component properties
   */
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.element = null;
  }

  /**
   * Sets the state and re-renders the component.
   * @param {Object} newState 
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.update();
  }

  /**
   * Returns the HTML string or DOM element for the component.
   * Must be overridden by subclasses.
   */
  render() {
    return `<div>Base Component</div>`;
  }

  /**
   * Mounts the component to a parent element.
   * @param {HTMLElement} parent 
   */
  mount(parent) {
    if (!parent) return;
    
    const template = document.createElement('template');
    template.innerHTML = this.render().trim();
    this.element = template.content.firstChild;
    
    parent.appendChild(this.element);
    this.onMount();
  }

  /**
   * Updates the component's DOM.
   * Simple implementation: replaces the old element with a new one.
   */
  update() {
    if (!this.element || !this.element.parentNode) return;
    
    // Cleanup old component listeners/subscriptions
    if (this.dispose) this.dispose();

    const parent = this.element.parentNode;
    const oldElement = this.element;
    
    const template = document.createElement('template');
    template.innerHTML = this.render().trim();
    this.element = template.content.firstChild;
    
    parent.replaceChild(this.element, oldElement);
    this.onMount();
  }

  /**
   * Lifecycle hook called after the component is mounted or updated.
   */
  onMount() {
    // Override in subclasses for event listeners, etc.
  }
}
