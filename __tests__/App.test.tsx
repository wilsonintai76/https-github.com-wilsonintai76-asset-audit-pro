import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App Smoke Test', () => {
    it('renders landing page by default', () => {
        render(<App />);
        expect(screen.getByText(/Master Your Audit Lifecycle/i)).toBeInTheDocument();
        expect(screen.getByText(/Asset Audit/i)).toBeInTheDocument();
    });
});
