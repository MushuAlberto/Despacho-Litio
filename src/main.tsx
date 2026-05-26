import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Patch window.getComputedStyle globally to prevent html2canvas from crashing 
// on modern Tailwind CSS v4 color functions like oklab() or oklch()
try {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (element, pseudoElt) {
    const style = originalGetComputedStyle(element, pseudoElt);
    
    const cleanValue = (val: any): any => {
      if (typeof val === 'string') {
        let changed = false;
        let newVal = val;
        
        // Remove color interpolation methods like "in oklab" or "in oklch" in gradients
        if (newVal.includes('in oklab')) {
          newVal = newVal.replace(/in oklab,\s*/gi, '');
          changed = true;
        }
        if (newVal.includes('in oklch')) {
          newVal = newVal.replace(/in oklch,\s*/gi, '');
          changed = true;
        }
        
        // Replace oklab() and oklch() color codes with safe fallback values
        if (newVal.includes('oklab(') || newVal.includes('oklch(')) {
          newVal = newVal.replace(/oklab\([^)]+\)/gi, 'rgba(0,0,0,0)');
          newVal = newVal.replace(/oklch\([^)]+\)/gi, 'rgba(0,0,0,0)');
          changed = true;
        }
        
        if (changed) {
          return newVal;
        }
      }
      return val;
    };

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            return cleanValue(target.getPropertyValue(propertyName));
          };
        }
        
        const val = Reflect.get(target, prop);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return cleanValue(val);
      }
    }) as any;
  };
} catch (e) {
  console.warn("Failed to apply html2canvas oklab fallback patch:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
