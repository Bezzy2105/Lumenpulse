#!/bin/bash

set -e

echo "🔧 Running code quality checks..."

echo "📝 1. Running Black formatting check..."
python -m black --check .

echo "🔍 2. Running Flake8 linting..."
python -m flake8 .

echo "📊 3. Running MyPy type checking..."
python -m mypy .

echo "⚡ 4. Running Ruff for additional linting..."
python -m ruff check .

echo "✅ All checks passed! Your code looks great! 🚀"