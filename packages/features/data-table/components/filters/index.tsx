"use client";

import { type Table } from "@tanstack/react-table";
// eslint-disable-next-line no-restricted-imports
import startCase from "lodash/startCase";
import { forwardRef, useState, useMemo, useCallback, Fragment } from "react";

import { classNames } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { ButtonProps } from "@calcom/ui";
import {
  Button,
  buttonClasses,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  Icon,
} from "@calcom/ui";

import { useDataTable } from "../../hooks";
import type { FilterableColumn } from "../../lib/types";
import { ClearFiltersButton } from "./ClearFiltersButton";
import { DateRangeFilter } from "./DateRangeFilter";
import { FilterPopover } from "./FilterPopover";

interface ColumnVisiblityProps<TData> {
  table: Table<TData>;
}

function ColumnVisibilityButtonComponent<TData>(
  {
    children,
    color = "secondary",
    EndIcon = "sliders-vertical",
    table,
    ...rest
  }: ColumnVisiblityProps<TData> & ButtonProps,
  ref: React.Ref<HTMLButtonElement>
) {
  const { t } = useLocale();
  const allColumns = table.getAllLeafColumns();
  const [open, setOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(allColumns.filter((col) => col.getIsVisible()).map((col) => col.id))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button ref={ref} color={color} EndIcon={EndIcon} {...rest}>
          {children ? children : t("View")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("search")} />
          <CommandList>
            <CommandEmpty>{t("no_columns_found")}</CommandEmpty>
            <CommandGroup heading={t("toggle_columns")}>
              {allColumns.map((column) => {
                const canHide = column.getCanHide();
                if (!column.columnDef.header || typeof column.columnDef.header !== "string" || !canHide)
                  return null;
                const isVisible = visibleColumns.has(column.id);
                return (
                  <CommandItem
                    key={column.id}
                    onSelect={() => {
                      column.toggleVisibility(!isVisible);
                      setVisibleColumns((prev) => {
                        const next = new Set(prev);
                        if (isVisible) {
                          next.delete(column.id);
                        } else {
                          next.add(column.id);
                        }
                        return next;
                      });
                    }}>
                    <div
                      className={classNames(
                        "border-subtle mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isVisible ? "text-emphasis" : "opacity-50 [&_svg]:invisible"
                      )}>
                      <Icon name="check" className={classNames("h-4 w-4", !isVisible && "invisible")} />
                    </div>
                    {column.columnDef.header}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                allColumns.forEach((column) => column.toggleVisibility(true));
                setVisibleColumns(new Set(allColumns.map((col) => col.id)));
              }}
              className={classNames(
                "w-full justify-center text-center",
                buttonClasses({ color: "secondary" })
              )}>
              {t("show_all_columns")}
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ColumnVisibilityButton = forwardRef(ColumnVisibilityButtonComponent) as <TData>(
  props: ColumnVisiblityProps<TData> & ButtonProps & { ref?: React.Ref<HTMLButtonElement> }
) => ReturnType<typeof ColumnVisibilityButtonComponent>;

// Filters
interface AddFilterButtonProps<TData> {
  table: Table<TData>;
}

function AddFilterButtonComponent<TData>(
  { table }: AddFilterButtonProps<TData>,
  ref: React.Ref<HTMLButtonElement>
) {
  const { t } = useLocale();
  const { activeFilters, setActiveFilters } = useDataTable();

  const filterableColumns = useFilterableColumns(table);

  const handleAddFilter = useCallback(
    (columnId: string) => {
      if (!activeFilters?.some((filter) => filter.f === columnId)) {
        setActiveFilters([...activeFilters, { f: columnId, v: undefined }]);
      }
    },
    [activeFilters, setActiveFilters]
  );

  return (
    <div className="flex items-center space-x-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button ref={ref} color="secondary" data-testid="add-filter-button">
            <Icon name="sliders-horizontal" className="mr-2 h-4 w-4" />
            {t("filter")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("search")} />
            <CommandList>
              <CommandEmpty>{t("no_columns_found")}</CommandEmpty>
              {filterableColumns.map((column) => {
                if (activeFilters?.some((filter) => filter.f === column.id)) return null;
                return (
                  <CommandItem
                    key={column.id}
                    onSelect={() => handleAddFilter(column.id)}
                    className="px-4 py-2">
                    {startCase(column.title)}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useFilterableColumns<TData>(table: Table<TData>) {
  const columns = useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table.getAllColumns()]
  );

  const filterableColumns = useMemo<FilterableColumn[]>(
    () =>
      columns
        .map((column) => {
          const type = column.columnDef.meta?.filter?.type || "multi_select";
          const base = {
            id: column.id,
            title: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id,
            ...(column.columnDef.meta?.filter || {}),
            type,
          };
          if (type === "multi_select" || type === "single_select") {
            const values = column.getFacetedUniqueValues();
            const options = Array.from(values.keys()).map((option) => {
              if (typeof option === "string") {
                return {
                  label: option,
                  value: option,
                };
              } else {
                return {
                  label: option.label as string,
                  value: option.value as string | number,
                };
              }
            });
            return {
              ...base,
              options,
            };
          } else {
            return {
              ...base,
            };
          }
        })
        .filter((column): column is FilterableColumn => Boolean(column)),
    [columns]
  );

  return filterableColumns;
}

const AddFilterButton = forwardRef(AddFilterButtonComponent) as <TData>(
  props: AddFilterButtonProps<TData> & { ref?: React.Ref<HTMLButtonElement> }
) => ReturnType<typeof AddFilterButtonComponent>;

// Add the new ActiveFilters component
interface ActiveFiltersProps<TData> {
  table: Table<TData>;
}

function ActiveFilters<TData>({ table }: ActiveFiltersProps<TData>) {
  const { activeFilters } = useDataTable();
  const filterableColumns = useFilterableColumns(table);

  return (
    <>
      {activeFilters.map((filter) => {
        const column = filterableColumns.find((col) => col.id === filter.f);
        if (!column) return null;
        return <FilterPopover key={column.id} column={column} />;
      })}
    </>
  );
}

// Update the export to include ActiveFilters
export const DataTableFilters = {
  ColumnVisibilityButton,
  AddFilterButton,
  ActiveFilters,
  ClearFiltersButton,
};

export { DateRangeFilter };
