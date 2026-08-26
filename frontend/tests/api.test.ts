import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../src/api/client', () => ({ default: apiClient }));

import { categoriesApi, taskPage } from '../src/api';

describe('API list adapters', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
  });

  it('unwraps a paginated list response', async () => {
    const categories = [{ id: 'vnn', name: 'VNN', result_fields: [], spec: {} }];
    apiClient.get.mockResolvedValue({ data: { count: 1, results: categories } });

    await expect(categoriesApi.list()).resolves.toEqual(categories);
    expect(apiClient.get).toHaveBeenCalledWith('/api/categories/');
  });

  it('accepts a plain list response', async () => {
    const categories = [{ id: 'arch', name: 'ARCH', result_fields: [], spec: {} }];
    apiClient.get.mockResolvedValue({ data: categories });

    await expect(categoriesApi.list()).resolves.toEqual(categories);
  });

  it('constructs an encoded task-page query and preserves page metadata', async () => {
    const response = { count: 0, results: [] };
    apiClient.get.mockResolvedValue({ data: response });

    await expect(taskPage({ type: 'tool', page: 2, pageSize: 25, search: 'a b&c' })).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith('/api/tasks/?type=tool&page=2&page_size=25&search=a%20b%26c');
  });
});
