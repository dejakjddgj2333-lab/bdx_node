<template>
  <div class="data-table">
    <table>
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="{ width: col.width, textAlign: col.align || 'left' }"
          >
            <slot name="header-cell" :column="col">{{ col.title }}</slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length" class="empty">加载中...</td>
        </tr>
        <tr v-else-if="!data.length">
          <td :colspan="columns.length" class="empty">暂无数据</td>
        </tr>
        <tr
          v-for="(row, idx) in data"
          :key="row.id || idx"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :style="{ textAlign: col.align || 'left' }"
          >
            <slot name="cell" :column="col" :row="row" :index="idx">{{ row[col.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  columns: {
    type: Array,
    required: true
  },
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.data-table {
  width: 100%;
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    background: $bg-hover;
    color: $text-secondary;
    padding: 14px 16px;
    text-align: left;
    font-weight: 500;
    font-size: 13px;
    border-bottom: 1px solid $border;
    white-space: nowrap;
  }

  td {
    padding: 14px 16px;
    border-bottom: 1px solid $border-subtle;
    color: $text;
    font-size: 14px;
  }

  tbody tr {
    transition: background 0.15s ease;

    &:hover {
      background: $bg-hover;
    }
  }

  .empty {
    text-align: center;
    color: $text-tertiary;
    padding: 40px;
  }
}
</style>
