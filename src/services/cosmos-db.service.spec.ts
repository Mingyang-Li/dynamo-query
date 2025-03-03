import { describe, expect, it, vi } from 'vitest';
import {
  BaseModel,
  FindManyArgs,
  FindOneArgs,
  Where,
  buildQueryFindMany,
  buildQueryFindOne,
  buildWhereClause,
  constructFieldSelection,
  constructOrderByClause,
} from './cosmos-db.service';
import { CosmosClient } from '@azure/cosmos';

type User = {
  firstName: string;
  lastName: string;
  age: number;
  createdAt: Date;
  isSuperAdmin: boolean;
};

describe(constructFieldSelection.name, () => {
  it('should return "*" when select object is undefined', () => {
    const result = constructFieldSelection(undefined);
    expect(result).toBe('*');
  });

  it('should return "*" when select object is empty', () => {
    const result = constructFieldSelection({});
    expect(result).toBe('*');
  });

  it('should return correct fields when some fields are selected', () => {
    const select: FindManyArgs<User>['select'] = {
      firstName: true,
      lastName: true,
      age: false,
    };
    const result = constructFieldSelection(select);
    expect(result).toBe('c.firstName, c.lastName');
  });

  it('should return all fields when all fields are selected', () => {
    const select: FindManyArgs<User>['select'] = {
      firstName: true,
      lastName: true,
      age: true,
    };
    const result = constructFieldSelection(select);
    expect(result).toBe('c.firstName, c.lastName, c.age');
  });

  it('should return empty string when no fields are selected', () => {
    const select: FindManyArgs<{}>['select'] = {
      firstName: false,
      lastName: false,
      age: false,
    };
    const result = constructFieldSelection(select);
    expect(result).toBe('*');
  });
});

describe(buildWhereClause.name, () => {
  it('should return an empty string when where clause is undefined', () => {
    const result = buildWhereClause<User>(undefined);
    expect(result).toBe('');
  });

  it('should return an empty string when where clause is empty', () => {
    const result = buildWhereClause<User>({});
    expect(result).toBe('');
  });

  it('should construct a complex where clause with mixed conditions', () => {
    const where: Where<User> = {
      firstName: { startsWith: 'haha', endsWith: 'hEEh', mode: 'INSENSITIVE' },
      lastName: { equals: 'hehe' },
      age: { lte: 10, notIn: [1, 2, 3] },
      isSuperAdmin: { not: true },
    };

    const result = buildWhereClause(where);
    expect(result).toBe(
      "WHERE STARTSWITH(LOWER(c.firstName), LOWER('haha')) AND LOWER(c.firstName) LIKE '%LOWER('hEEh')' AND c.lastName = 'hehe' AND c.age <= 10 AND c.age NOT IN (1, 2, 3) AND c.isSuperAdmin != true",
    );
  });

  it('should handle case-sensitive and case-insensitive conditions', () => {
    const where: Where<User> = {
      firstName: { startsWith: 'A', mode: 'SENSITIVE' },
      lastName: { endsWith: 'z', mode: 'INSENSITIVE' },
    };

    const result = buildWhereClause(where);
    expect(result).toBe(
      "WHERE STARTSWITH(c.firstName, 'A') AND LOWER(c.lastName) LIKE '%LOWER('z')'",
    );
  });

  it('should handle "in" and "notIn" conditions', () => {
    const where: Where<User> = {
      age: { in: [25, 30, 35] },
      firstName: { notIn: ['Alice', 'Bob'] },
    };

    const result = buildWhereClause(where);
    expect(result).toBe(
      "WHERE c.age IN (25, 30, 35) AND c.firstName NOT IN ('Alice', 'Bob')",
    );
  });
});

describe(constructOrderByClause.name, () => {
  it('should return an empty string when orderBy is undefined', () => {
    const result = constructOrderByClause<User>(undefined);
    expect(result).toBe('');
  });

  it('should return an empty string when orderBy is empty', () => {
    const result = constructOrderByClause<User>({});
    expect(result).toBe('');
  });

  it('should construct an ORDER BY clause for a single field', () => {
    const orderBy: FindManyArgs<User>['orderBy'] = {
      age: 'ASC',
    };

    const result = constructOrderByClause(orderBy);
    expect(result).toBe('ORDER BY c.age ASC');
  });

  it('should construct an ORDER BY clause for multiple fields', () => {
    const orderBy: FindManyArgs<User>['orderBy'] = {
      lastName: 'DESC',
      firstName: 'ASC',
    };

    const result = constructOrderByClause(orderBy);
    expect(result).toBe('ORDER BY c.lastName DESC, c.firstName ASC');
  });

  it('should handle mixed case directions', () => {
    const orderBy: FindManyArgs<User>['orderBy'] = {
      createdAt: 'DESC',
      isSuperAdmin: 'ASC',
    };

    const result = constructOrderByClause(orderBy);
    expect(result).toBe('ORDER BY c.createdAt DESC, c.isSuperAdmin ASC');
  });
});

describe(buildQueryFindMany.name, () => {
  it('should construct a query with only select fields', () => {
    const args: FindManyArgs<User> = {
      select: { firstName: true, lastName: true },
    };

    const result = buildQueryFindMany(args);
    expect(result).toBe('SELECT c.firstName, c.lastName FROM c');
  });

  it('should construct a query with where clause', () => {
    const args: FindManyArgs<User> = {
      where: {
        age: { gt: 30 },
        isSuperAdmin: { equals: true },
      },
    };

    const result = buildQueryFindMany(args);
    expect(result).toBe(
      'SELECT * FROM c WHERE c.age > 30 AND c.isSuperAdmin = true',
    );
  });

  it('should construct a query with order by clause', () => {
    const args: FindManyArgs<User> = {
      orderBy: { createdAt: 'DESC' },
    };

    const result = buildQueryFindMany(args);
    expect(result).toBe('SELECT * FROM c ORDER BY c.createdAt DESC');
  });

  it('should construct a query with select, where, and order by clauses', () => {
    const args: FindManyArgs<User> = {
      select: { firstName: true, lastName: true },
      where: {
        age: { lte: 50 },
      },
      orderBy: { createdAt: 'ASC' },
    };

    const result = buildQueryFindMany(args);
    expect(result).toBe(
      'SELECT c.firstName, c.lastName FROM c WHERE c.age <= 50 ORDER BY c.createdAt ASC',
    );
  });

  it('should handle empty args gracefully', () => {
    const args: FindManyArgs<User> = {};

    const result = buildQueryFindMany(args);
    expect(result).toBe('SELECT * FROM c');
  });
});

describe(buildQueryFindOne.name, () => {
  it('should construct a query with only the ID in the where clause', () => {
    const args: FindOneArgs<User> = {
      where: { id: '123' },
    };

    const result = buildQueryFindOne(args);
    expect(result).toBe("SELECT * FROM c WHERE c.id = '123'");
  });

  it('should construct a query with selected fields', () => {
    const args: FindOneArgs<User> = {
      where: { id: '123' },
      select: { firstName: true, lastName: true },
    };

    const result = buildQueryFindOne(args);
    expect(result).toBe(
      "SELECT c.firstName, c.lastName FROM c WHERE c.id = '123'",
    );
  });

  it('should handle an empty select object by selecting all fields', () => {
    const args: FindOneArgs<User> = {
      where: { id: '123' },
      select: {},
    };

    const result = buildQueryFindOne(args);
    expect(result).toBe("SELECT * FROM c WHERE c.id = '123'");
  });

  it('should handle undefined select by selecting all fields', () => {
    const args: FindOneArgs<User> = {
      where: { id: '123' },
    };

    const result = buildQueryFindOne(args);
    expect(result).toBe("SELECT * FROM c WHERE c.id = '123'");
  });
});

type MethodNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

// Function to get the method name
const getMethodName = <T>(methodName: MethodNames<T>): string => {
  return methodName as string;
};

describe(BaseModel.name, () => {
  // mock CosmosClient globally, then re-mock it for ease test-case
  vi.mock('@azure/cosmos', () => ({
    CosmosClient: vi.fn().mockImplementation(() => ({
      database: () => ({
        container: () => ({
          items: {
            query: () => ({
              fetchNext: vi.fn().mockResolvedValue({
                resources: [], // default mocked value
              }),
            }),
          },
        }),
      }),
    })),
  }));

  describe(getMethodName<BaseModel>('findMany'), () => {
    it('Should return [] when resources is [] (empty array)', async () => {
      const baseModel = new BaseModel({
        client: new CosmosClient(''),
        database: '',
        container: '',
      });

      const result = await baseModel.findMany({});
      expect(result.items).toEqual([]);
    });

    it('Should return [] when resources is undefined', async () => {
      // mock
      vi.mocked(CosmosClient as any).mockImplementationOnce(() => ({
        database: () => ({
          container: () => ({
            items: {
              query: () => ({
                fetchNext: vi.fn().mockResolvedValue({
                  resources: undefined,
                }),
              }),
            },
          }),
        }),
      }));

      const baseModel = new BaseModel({
        client: new CosmosClient(''),
        database: '',
        container: '',
      });

      const result = await baseModel.findMany({});
      expect(result.items).toEqual([]);
    });

    it('Should throw error when resources is null', async () => {
      // mock
      vi.mocked(CosmosClient as any).mockImplementationOnce(() => ({
        database: () => ({
          container: () => ({
            items: {
              query: () => ({
                fetchNext: vi.fn().mockResolvedValue({
                  resources: null,
                }),
              }),
            },
          }),
        }),
      }));

      const baseModel = new BaseModel({
        client: new CosmosClient(''),
        database: '',
        container: '',
      });

      await expect(baseModel.findMany({})).rejects.toThrowError();
    });
  });
});
