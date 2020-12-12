import { configureStore } from '@reduxjs/toolkit';
import { Api, createApi, fetchBaseQuery } from '@rtk-incubator/rtk-query';
import { QueryDefinition, MutationDefinition } from '@internal/endpointDefinitions';
import { ANY, expectExactType, expectType, waitMs } from './helpers';

test('sensible defaults', () => {
  const api = createApi({
    baseQuery: fetchBaseQuery(),
    endpoints: (build) => ({
      getUser: build.query<unknown, void>({
        query(id) {
          return { url: `user/${id}` };
        },
      }),
    }),
  });
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
  expect(api.reducerPath).toBe('api');

  expectType<'api'>(api.reducerPath);
  type EntityTypes = typeof api extends Api<any, any, any, infer E> ? E : 'no match';
  expectType<EntityTypes>(ANY as never);
  // @ts-expect-error
  expectType<EntityTypes>(0);
});

describe('wrong entityTypes log errors', () => {
  const baseQuery = jest.fn();
  const api = createApi({
    baseQuery,
    entityTypes: ['User'],
    endpoints: (build) => ({
      provideNothing: build.query<unknown, void>({
        query: () => '',
      }),
      provideTypeString: build.query<unknown, void>({
        query: () => '',
        provides: ['User'],
      }),
      provideTypeWithId: build.query<unknown, void>({
        query: () => '',
        provides: [{ type: 'User', id: 5 }],
      }),
      provideTypeWithIdAndCallback: build.query<unknown, void>({
        query: () => '',
        provides: () => [{ type: 'User', id: 5 }],
      }),
      provideWrongTypeString: build.query<unknown, void>({
        query: () => '',
        // @ts-expect-error
        provides: ['Users'],
      }),
      provideWrongTypeWithId: build.query<unknown, void>({
        query: () => '',
        // @ts-expect-error
        provides: [{ type: 'Users', id: 5 }],
      }),
      provideWrongTypeWithIdAndCallback: build.query<unknown, void>({
        query: () => '',
        // @ts-expect-error
        provides: () => [{ type: 'Users', id: 5 }],
      }),
      invalidateNothing: build.query<unknown, void>({
        query: () => '',
      }),
      invalidateTypeString: build.mutation<unknown, void>({
        query: () => '',
        invalidates: ['User'],
      }),
      invalidateTypeWithId: build.mutation<unknown, void>({
        query: () => '',
        invalidates: [{ type: 'User', id: 5 }],
      }),
      invalidateTypeWithIdAndCallback: build.mutation<unknown, void>({
        query: () => '',
        invalidates: () => [{ type: 'User', id: 5 }],
      }),

      invalidateWrongTypeString: build.mutation<unknown, void>({
        query: () => '',
        // @ts-expect-error
        invalidates: ['Users'],
      }),
      invalidateWrongTypeWithId: build.mutation<unknown, void>({
        query: () => '',
        // @ts-expect-error
        invalidates: [{ type: 'Users', id: 5 }],
      }),
      invalidateWrongTypeWithIdAndCallback: build.mutation<unknown, void>({
        query: () => '',
        // @ts-expect-error
        invalidates: () => [{ type: 'Users', id: 5 }],
      }),
    }),
  });
  const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });

  const originalEnv = process.env.NODE_ENV;
  beforeAll(() => void (process.env.NODE_ENV = 'development'));
  afterAll(() => void (process.env.NODE_ENV = originalEnv));

  beforeEach(() => {
    baseQuery.mockResolvedValue({});
  });

  let spy: jest.SpyInstance;
  beforeAll(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockReset();
  });
  afterAll(() => {
    spy.mockRestore();
  });

  test.each<[keyof typeof api.endpoints, boolean?]>([
    ['provideNothing', false],
    ['provideTypeString', false],
    ['provideTypeWithId', false],
    ['provideTypeWithIdAndCallback', false],
    ['provideWrongTypeString', true],
    ['provideWrongTypeWithId', true],
    ['provideWrongTypeWithIdAndCallback', true],
    ['invalidateNothing', false],
    ['invalidateTypeString', false],
    ['invalidateTypeWithId', false],
    ['invalidateTypeWithIdAndCallback', false],
    ['invalidateWrongTypeString', true],
    ['invalidateWrongTypeWithId', true],
    ['invalidateWrongTypeWithIdAndCallback', true],
  ])(`endpoint %s should log an error? %s`, async (endpoint, shouldError) => {
    // @ts-ignore
    store.dispatch(api.endpoints[endpoint].initiate());
    let result: { status: string };
    do {
      await waitMs(5);
      // @ts-ignore
      result = api.endpoints[endpoint].select()(store.getState());
    } while (result.status === 'pending');

    if (shouldError) {
      expect(spy).toHaveBeenCalledWith("Entity type 'Users' was used, but not specified in `entityTypes`!");
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('endpoint definition typings', () => {
  const api = createApi({
    baseQuery: (from: 'From'): { data: 'To' } | Promise<{ data: 'To' }> => ({ data: 'To' }),
    endpoints: () => ({}),
    entityTypes: ['typeA', 'typeB'],
  });
  test('query: query & transformResponse types', () => {
    api.injectEndpoints({
      endpoints: (build) => ({
        query: build.query<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query1: build.query<'RetVal', 'Arg'>({
          // @ts-expect-error
          query: (x: 'Error') => 'From' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query2: build.query<'RetVal', 'Arg'>({
          // @ts-expect-error
          query: (x: 'Arg') => 'Error' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query3: build.query<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          // @ts-expect-error
          transformResponse(r: 'Error') {
            return 'RetVal' as const;
          },
        }),
        query4: build.query<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          // @ts-expect-error
          transformResponse(r: 'To') {
            return 'Error' as const;
          },
        }),
        queryInference1: build.query<'RetVal', 'Arg'>({
          query: (x) => {
            expectType<'Arg'>(x);
            return 'From';
          },
          transformResponse(r) {
            expectType<'To'>(r);
            return 'RetVal';
          },
        }),
        queryInference2: (() => {
          const query = build.query({
            query: (x: 'Arg') => 'From' as const,
            transformResponse(r: 'To') {
              return 'RetVal' as const;
            },
          });
          expectType<QueryDefinition<'Arg', any, any, 'RetVal'>>(query);
          return query;
        })(),
      }),
    });
  });
  test('mutation: query & transformResponse types', () => {
    api.injectEndpoints({
      endpoints: (build) => ({
        query: build.mutation<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query1: build.mutation<'RetVal', 'Arg'>({
          // @ts-expect-error
          query: (x: 'Error') => 'From' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query2: build.mutation<'RetVal', 'Arg'>({
          // @ts-expect-error
          query: (x: 'Arg') => 'Error' as const,
          transformResponse(r: 'To') {
            return 'RetVal' as const;
          },
        }),
        query3: build.mutation<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          // @ts-expect-error
          transformResponse(r: 'Error') {
            return 'RetVal' as const;
          },
        }),
        query4: build.mutation<'RetVal', 'Arg'>({
          query: (x: 'Arg') => 'From' as const,
          // @ts-expect-error
          transformResponse(r: 'To') {
            return 'Error' as const;
          },
        }),
        mutationInference1: build.mutation<'RetVal', 'Arg'>({
          query: (x) => {
            expectType<'Arg'>(x);
            return 'From';
          },
          transformResponse(r) {
            expectType<'To'>(r);
            return 'RetVal';
          },
        }),
        mutationInference2: (() => {
          const query = build.mutation({
            query: (x: 'Arg') => 'From' as const,
            transformResponse(r: 'To') {
              return 'RetVal' as const;
            },
          });
          expectType<MutationDefinition<'Arg', any, any, 'RetVal'>>(query);
          return query;
        })(),
      }),
    });
  });

  describe('enhancing endpoint definitions', () => {
    const api = createApi({
      baseQuery: fetchBaseQuery(),
      endpoints: (build) => ({
        query1: build.query<'out1', 'in1'>({ query: (id) => `${id}` }),
        query2: build.query<'out2', 'in2'>({ query: (id) => `${id}` }),
        mutation1: build.mutation<'out1', 'in1'>({ query: (id) => `${id}` }),
        mutation2: build.mutation<'out2', 'in2'>({ query: (id) => `${id}` }),
      }),
    });

    let assertionCount = 0;

    api.enhanceEndpoints({
      query1(definition) {
        assertionCount++;
        expect(definition.query('in1')).toBe('in1');
      },
      query2(definition) {
        assertionCount++;
        expect(definition.query('in2')).toBe('in2');
      },
      mutation1(definition) {
        assertionCount++;
        expect(definition.query('in1')).toBe('in1');
      },
      mutation2(definition) {
        assertionCount++;
        expect(definition.query('in2')).toBe('in2');
      },
    });

    api.enhanceEndpoints({
      query1: {
        query: (x) => {
          expectExactType('in1' as const)(x);
          return 'modified1';
        },
      },
      query2(definition) {
        definition.query = (x) => {
          expectExactType('in2' as const)(x);
          return 'modified2';
        };
      },
      mutation1: {
        query: (x) => {
          expectExactType('in1' as const)(x);
          return 'modified1';
        },
      },
      mutation2(definition) {
        definition.query = (x) => {
          expectExactType('in2' as const)(x);
          return 'modified2';
        };
      },
      // @ts-expect-error
      nonExisting: {},
    });

    api.enhanceEndpoints({
      query1(definition) {
        assertionCount++;
        expect(definition.query('in1')).toBe('modified1');
      },
      query2(definition) {
        assertionCount++;
        expect(definition.query('in2')).toBe('modified2');
      },
      mutation1(definition) {
        assertionCount++;
        expect(definition.query('in1')).toBe('modified1');
      },
      mutation2(definition) {
        assertionCount++;
        expect(definition.query('in2')).toBe('modified2');
      },
      // @ts-expect-error
      nonExisting(definition) {
        assertionCount++;
        expect(definition).toBeUndefined();
      },
    });
    expect(assertionCount).toBe(9);
  });
});
