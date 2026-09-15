import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tracksApi = vi.hoisted(() => ({ list: vi.fn(), scoreboard: vi.fn() }));
vi.mock('../src/api', () => ({ tracksApi }));

import ScoreboardPage from '../src/pages/ScoreboardPage';

describe('ScoreboardPage', () => {
  beforeEach(() => {
    tracksApi.list.mockReset();
    tracksApi.scoreboard.mockReset();
    tracksApi.list.mockResolvedValue([{ id: 'track-1', name: 'Main' }]);
    tracksApi.scoreboard.mockResolvedValue({
      columns: ['tool', 'solved'], rows: [],
      groups: [
        { name: 'test', columns: ['tool', 'solved'], rows: [{ tool: 'SmokeTool', solved: 1 }] },
        { name: 'regular', columns: ['tool', 'solved'], rows: [{ tool: 'MainTool', solved: 8 }] },
      ],
    });
  });

  it('renders a separate table for every benchmark group', async () => {
    render(<MemoryRouter><ScoreboardPage /></MemoryRouter>);

    expect(await screen.findByText('SmokeTool')).toBeInTheDocument();
    expect(screen.getByText('MainTool')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'test' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'regular' })).toBeInTheDocument();
  });
});
