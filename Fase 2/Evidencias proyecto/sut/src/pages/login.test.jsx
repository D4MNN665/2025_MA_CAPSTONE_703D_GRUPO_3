

import { render, screen, fireEvent } from '@testing-library/react';
import Login from './login';
import { BrowserRouter } from 'react-router-dom';

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

jest.mock('../context/auth', () => ({
  useAuth: () => ({
    login: jest.fn(),
  }),
}));

test('renderiza el formulario de login', () => {
  renderWithRouter(<Login />);
  expect(screen.getByLabelText(/rut/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
});