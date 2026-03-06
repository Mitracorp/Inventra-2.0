import React, { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { User, Lock, Mail, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

const Register = ({ onRegister }) => {
    usePageTitle('Register');
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        email: '',
        password: '',
        role: 'staff', // default role
    });

    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { full_name, username, email, password, role } = formData;
        if (!full_name || !username || !email || !password || !role) {
            setMessage('Please fill in all fields.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage('Registration successful! Redirecting to login...');
                setFormData({ full_name: '', username: '', email: '', password: '', role: 'staff' });
                // Wait for 2 seconds to show the success message, then redirect
                setTimeout(() => {
                    navigate('/login');
                }, 2000); onRegister();
            } else {
                setMessage(data.message || 'Registration failed.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setMessage('Unable to connect to the server.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">Create New Account</h2>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>
                            <UserCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Full Name
                        </label>
                        <input
                            type="text"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleChange}
                            placeholder="Enter full name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            <User size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Username
                        </label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            <Mail size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Enter email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            <Lock size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Role</label>
                        <select name="role" value={formData.role} onChange={handleChange}>
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Register
                    </button>
                </form>

                {message && (
                    <p style={{ marginTop: '10px', textAlign: 'center', color: '#555' }}>{message}</p>
                )}
            </div>
        </div>
    );
};

export default Register;
